import { backup } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
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
  function listar() {
    mkdirSync(pasta, { recursive: true });
    return readdirSync(pasta)
      .filter((nome) => /^backup-[\dT-]+\.sqlite$/.test(nome))
      .map((nome) => ({ nome, tamanho: statSync(join(pasta, nome)).size }))
      .reverse();
  }
  async function criar(usuario: Usuario) {
    if (ocupado) throw new ErroCadastro('Já existe um backup em andamento.', 409);
    ocupado = true;
    let temporario = '';
    try {
      mkdirSync(pasta, { recursive: true });
      const nome = `backup-${new Date().toISOString().replace(/[:.Z]/g, '-')}.sqlite`;
      temporario = join(pasta, `${nome}.partial`);
      await backup(banco.db, temporario);
      renameSync(temporario, join(pasta, nome));
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
