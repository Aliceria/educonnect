import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { ErroCadastro } from './modulos/Professores.ts';

export type Dados = Record<string, unknown>;
export type Usuario = { id: string; nome: string; email: string; perfil: 'Administrador' | 'Professor'; professorId: string; permissoes: string[]; ativo: boolean };
export type Registro = { id: string; tipo: string; autorId: string; versao: number; dados: Dados };
export const modulos = ['professores', 'disciplinas', 'materiais', 'avaliacoes', 'presenca', 'relatorios', 'financeiro', 'configuracoes', 'seguranca', 'historico'];

export function abrirBanco(caminho: string) {
  const db = new DatabaseSync(caminho);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS registros (id TEXT PRIMARY KEY, tipo TEXT NOT NULL, autorId TEXT NOT NULL, versao INTEGER NOT NULL, dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, usuarioId TEXT NOT NULL, usuario TEXT NOT NULL, modulo TEXT NOT NULL, acao TEXT NOT NULL, registroId TEXT NOT NULL, detalhes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS anexos (registroId TEXT PRIMARY KEY, nome TEXT NOT NULL, mime TEXT NOT NULL, conteudo BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS compartilhamentos (id TEXT PRIMARY KEY, materialId TEXT NOT NULL, alunoId TEXT NOT NULL, destinatario TEXT NOT NULL, data TEXT NOT NULL, autorId TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, dados TEXT NOT NULL, senha TEXT NOT NULL, recuperacao TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, usuarioId TEXT NOT NULL, ultimaAtividade INTEGER NOT NULL, criada INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ajustes (chave TEXT PRIMARY KEY, dados TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS registros_tipo_autor ON registros(tipo, autorId);
    CREATE INDEX IF NOT EXISTS presencas_aula ON registros(json_extract(dados,'$.aulaId')) WHERE tipo='presencas';
    CREATE INDEX IF NOT EXISTS historico_usuario ON historico(usuarioId, id);
    CREATE INDEX IF NOT EXISTS historico_modulo ON historico(modulo, id);
    CREATE INDEX IF NOT EXISTS compartilhamentos_material ON compartilhamentos(materialId);
  `);
  function evento(usuario: Usuario, modulo: string, acao: string, registroId: string, detalhes: Dados = {}) {
    db.prepare('INSERT INTO historico (data,usuarioId,usuario,modulo,acao,registroId,detalhes) VALUES (?,?,?,?,?,?,?)')
      .run(new Date().toISOString(), usuario.id, usuario.nome, modulo, acao, registroId, JSON.stringify(detalhes));
  }
  function listar(tipo: string, usuario: Usuario): Registro[] {
    const linhas = usuario.perfil === 'Administrador'
      ? db.prepare('SELECT * FROM registros WHERE tipo = ? ORDER BY rowid DESC').all(tipo)
      : db.prepare('SELECT * FROM registros WHERE tipo = ? AND autorId = ? ORDER BY rowid DESC').all(tipo, usuario.id);
    return linhas.map(linha => ({ id: String(linha.id), tipo, autorId: String(linha.autorId), versao: Number(linha.versao), dados: JSON.parse(String(linha.dados)) }));
  }
  function buscar(tipo: string, id: string, usuario: Usuario) {
    const linha = db.prepare('SELECT * FROM registros WHERE id=? AND tipo=? AND (?=1 OR autorId=?)')
      .get(id, tipo, usuario.perfil === 'Administrador' ? 1 : 0, usuario.id);
    if (!linha) throw new ErroCadastro('Registro não encontrado ou sem permissão.', 404);
    return { id: String(linha.id), tipo, autorId: String(linha.autorId), versao: Number(linha.versao), dados: JSON.parse(String(linha.dados)) as Dados };
  }
  function salvar(tipo: string, dados: Dados, usuario: Usuario, id?: string, versao?: number) {
    const anterior = id ? buscar(tipo, id, usuario) : undefined;
    if (anterior && anterior.versao !== versao) throw new ErroCadastro('Registro alterado em outra janela. Atualize a lista.', 409);
    const registro = { id: id ?? randomUUID(), tipo, autorId: anterior?.autorId ?? usuario.id, versao: (anterior?.versao ?? 0) + 1, dados };
    db.prepare('INSERT INTO registros (id,tipo,autorId,versao,dados) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET versao=excluded.versao,dados=excluded.dados')
      .run(registro.id, tipo, registro.autorId, registro.versao, JSON.stringify(dados));
    evento(usuario, tipo, anterior ? 'Alteração' : 'Cadastro', registro.id, { antes: anterior?.dados ?? null, depois: dados });
    return registro;
  }
  return { db, evento, listar, buscar, salvar, fechar: () => db.close() };
}
export type Banco = ReturnType<typeof abrirBanco>;
export function permitir(usuario: Usuario, modulo: string, somenteAdmin = false) {
  if (usuario.perfil !== 'Administrador' && (somenteAdmin || !usuario.permissoes.includes(modulo))) throw new ErroCadastro('Você não tem permissão para esta operação.', 403);
}
export function objeto(valor: unknown): Dados {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ErroCadastro('Dados inválidos.');
  return valor as Dados;
}
export function texto(d: Dados, campo: string, obrigatorio = true, limite = 2000): string {
  if (typeof d[campo] !== 'string' || (obrigatorio && !d[campo].trim()) || d[campo].length > limite) throw new ErroCadastro(`Confira o campo ${campo}.`);
  return d[campo].trim();
}
export function numero(d: Dados, campo: string, minimo = 0, maximo = 1000000): number {
  const n = d[campo];
  if (typeof n !== 'number' || !Number.isFinite(n) || n < minimo || n > maximo) throw new ErroCadastro(`Confira o campo ${campo}.`);
  return n;
}
export function escolha(d: Dados, campo: string, opcoes: string[]): string {
  const valor = texto(d, campo);
  if (!opcoes.includes(valor)) throw new ErroCadastro(`Opção inválida em ${campo}.`);
  return valor;
}
export function data(d: Dados, campo: string): string {
  const valor = texto(d, campo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor)) || new Date(valor).toISOString().slice(0,10) !== valor) throw new ErroCadastro(`Data inválida em ${campo}.`);
  return valor;
}
