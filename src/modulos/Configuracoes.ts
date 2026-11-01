import { backup } from 'node:sqlite';
import { chmodSync, mkdirSync, readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { texto, numero, permitir } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';

export const padrao = {
  instituicao: '',
  contato: '',
  valorHora: 0,
  horarios: '',
  lembretesMinutos: 60,
  formasPagamento: 'Pix, Dinheiro',
  modeloMensagem: '',
  modeloPlano: '',
  sessaoMinutos: 20,
  backupHoras: 24,
};

function protegerCaminho(caminho: string, diretorio: boolean) {
  if (process.platform !== 'win32') {
    chmodSync(caminho, diretorio ? 0o700 : 0o600);
    return;
  }

  const identidade = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const sid = identidade.match(/"([^"]+)"\s*$/m)?.[1];
  if (!sid || !/^S-\d-(?:\d+-)+\d+$/.test(sid))
    throw new ErroCadastro('Não foi possível identificar a conta para proteger o backup.');

  const permissao = diretorio ? '(OI)(CI)F' : 'F';
  const regras = [...new Set(['*S-1-5-18', `*${sid}`])]
    .map((id) => `${id}:${permissao}`);
  execFileSync('icacls.exe', [caminho, '/inheritance:r', '/grant:r', ...regras], {
    stdio: 'pipe',
    windowsHide: true,
  });
}

export function lerConfiguracoes(banco: Banco) {
  const linha = banco.db.prepare("SELECT dados FROM ajustes WHERE chave='geral'").get();
  return { ...padrao, ...(linha ? JSON.parse(String(linha.dados)) : {}) } as typeof padrao;
}
export function salvarConfiguracoes(banco: Banco, usuario: Usuario, d: Dados) {
  permitir(usuario, 'configuracoes', true);
  const dados = {
    instituicao: texto(d, 'instituicao', false),
    contato: texto(d, 'contato', false),
    valorHora: numero(d, 'valorHora'),
    horarios: texto(d, 'horarios', false),
    lembretesMinutos: numero(d, 'lembretesMinutos', 0, 10080),
    formasPagamento: texto(d, 'formasPagamento'),
    modeloMensagem: texto(d, 'modeloMensagem', false, 10000),
    modeloPlano: texto(d, 'modeloPlano', false, 10000),
    sessaoMinutos: numero(d, 'sessaoMinutos', 5, 120),
    backupHoras: numero(d, 'backupHoras', 1, 168),
  };
  if (Math.abs(dados.valorHora * 100 - Math.round(dados.valorHora * 100)) > 0.000001)
    throw new ErroCadastro('O valor da hora-aula deve ter até duas casas decimais.');
  const antes = lerConfiguracoes(banco);
  banco.db
    .prepare(
      "INSERT INTO ajustes VALUES ('geral',?) ON CONFLICT(chave) DO UPDATE SET dados=excluded.dados",
    )
    .run(JSON.stringify(dados));
  banco.evento(usuario, 'configuracoes', 'Configurações alteradas', 'geral', {
    antes,
    depois: dados,
  });
  return dados;
}
export function backups(banco: Banco, pasta: string) {
  let ocupado = false;
  let ultimaFalha = '';
  function prepararPasta() {
    mkdirSync(pasta, { recursive: true });
    protegerCaminho(pasta, true);
  }
  function listar() {
    prepararPasta();
    return readdirSync(pasta)
      .filter((nome) => /^backup-[\dT-]+\.sqlite$/.test(nome))
      .map((nome) => {
        const caminho = join(pasta, nome);
        protegerCaminho(caminho, false);
        return { nome, tamanho: statSync(caminho).size };
      })
      .reverse();
  }
  async function criar(usuario: Usuario) {
    if (ocupado) throw new ErroCadastro('Já existe um backup em andamento.', 409);
    ocupado = true;
    let temporario = '';
    try {
      prepararPasta();
      const nome = `backup-${new Date().toISOString().replace(/[:.Z]/g, '-')}.sqlite`;
      temporario = join(pasta, `${nome}.partial`);
      await backup(banco.db, temporario);
      protegerCaminho(temporario, false);
      renameSync(temporario, join(pasta, nome));
      protegerCaminho(join(pasta, nome), false);
      banco.db
        .prepare(
          "INSERT INTO ajustes VALUES ('ultimoBackup',?) ON CONFLICT(chave) DO UPDATE SET dados=excluded.dados",
        )
        .run(JSON.stringify(Date.now()));
      banco.evento(usuario, 'configuracoes', 'Backup criado', nome);
      ultimaFalha = '';
      return { nome };
    } catch (erro) {
      ultimaFalha = 'Não foi possível criar o backup.';
      throw erro;
    } finally {
      ocupado = false;
      if (temporario) rmSync(temporario, { force: true });
    }
  }
  async function automatico(usuario: Usuario) {
    const linha = banco.db.prepare("SELECT dados FROM ajustes WHERE chave='ultimoBackup'").get();
    if (
      Date.now() - Number(linha ? JSON.parse(String(linha.dados)) : 0) >=
        lerConfiguracoes(banco).backupHoras * 3600000 &&
      !ocupado
    )
      await criar(usuario);
  }
  return { listar, criar, automatico, falha: () => ultimaFalha };
}
