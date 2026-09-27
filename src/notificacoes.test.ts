import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { abrirBanco, modulos } from './banco.ts';
import type { Banco, Usuario } from './banco.ts';
import { listarNotificacoes, marcarNotificacoes } from './modulos/Notificacoes.ts';
import { criarServidor } from './servidor.ts';

const agora = new Date('2026-09-27T12:00:00Z');
function cenario(banco: Banco, professorId = 'professor-a') {
  const usuario: Usuario = { id: randomUUID(), nome: 'Professor de teste', email: 'prof@example.test', professorId, perfil: 'Professor', permissoes: [...modulos], ativo: true };
  const aluno = banco.salvar('alunos', { nome: 'Aluno ' + professorId, professorId, status: 'Ativo' }, usuario);
  const aula = banco.salvar('aulas', { alunoId: aluno.id, professorId, data: '2026-09-27', hora: '09:30', status: 'Agendada' }, usuario);
  const pagamento = banco.salvar('pagamentos', { alunoId: aluno.id, professorId, nome: 'Mensalidade', vencimento: '2026-09-28', status: 'Pendente' }, usuario);
  banco.salvar('pagamentos', { alunoId: aluno.id, professorId, nome: 'Mensalidade anterior', vencimento: '2026-09-26', status: 'Pendente' }, usuario);
  const avaliacao = banco.salvar('avaliacoes', { alunoId: aluno.id, professorId, nome: 'Prova de matemática', data: '2026-09-27' }, usuario);
  const material = banco.salvar('materiais', { nome: 'Exercícios de matemática', status: 'Ativo' }, usuario);
  banco.db.prepare('UPDATE historico SET data=?').run(agora.toISOString());
  return { usuario, aluno, aula, pagamento, avaliacao, material };
}

test('gera os seis avisos previstos, com prioridade, título, mensagem, data e leitura', () => {
  const banco = abrirBanco(':memory:');
  try {
    const { usuario } = cenario(banco);
    const lista = listarNotificacoes(banco, usuario, agora);
    assert.equal(lista.naoLidas, 6);
    assert.deepEqual(new Set(lista.notificacoes.map(n => n.tipo)), new Set(['aula', 'pagamento', 'avaliacao', 'material', 'planejamento']));
    assert.ok(lista.notificacoes.some(n => n.titulo === 'Pagamento atrasado' && n.prioridade === 'Alta'));
    assert.ok(lista.notificacoes.some(n => n.titulo === 'Pagamento próximo' && n.prioridade === 'Média'));
    for (const n of lista.notificacoes) {
      assert.ok(n.id && n.titulo && n.mensagem && Number.isFinite(Date.parse(n.data)));
      assert.equal(n.lida, false);
    }
    const id = lista.notificacoes[0].id;
    assert.equal(marcarNotificacoes(banco, usuario, id, agora).naoLidas, 5);
    assert.equal(marcarNotificacoes(banco, usuario, id, agora).naoLidas, 5);
    assert.equal(marcarNotificacoes(banco, usuario, undefined, agora).naoLidas, 0);
    assert.ok(listarNotificacoes(banco, usuario, agora).notificacoes.every(n => n.lida));
    assert.equal(banco.db.prepare('SELECT count(*) AS n FROM notificacoes_leituras').get()!.n, 6);
  } finally { banco.fechar(); }
});

test('isola professores, mantém leitura por conta e aplica revogação de permissões', () => {
  const banco = abrirBanco(':memory:');
  try {
    const a = cenario(banco);
    const b = cenario(banco, 'professor-b');
    const primeira = listarNotificacoes(banco, a.usuario, agora);
    assert.equal(listarNotificacoes(banco, b.usuario, agora).naoLidas, 6);
    assert.throws(() => marcarNotificacoes(banco, b.usuario, primeira.notificacoes.find(n => n.tipo === 'aula')!.id, agora), /não encontrada/);
    marcarNotificacoes(banco, a.usuario, undefined, agora);
    assert.equal(listarNotificacoes(banco, b.usuario, agora).naoLidas, 6);
    const mesmaPessoaOutroLogin = { ...a.usuario, id: randomUUID() };
    assert.equal(listarNotificacoes(banco, mesmaPessoaOutroLogin, agora).naoLidas, 5); // material pertence ao autor
    assert.equal(listarNotificacoes(banco, { ...a.usuario, permissoes: [] }, agora).notificacoes.length, 0);
    const semFinanceiro = listarNotificacoes(banco, { ...a.usuario, permissoes: ['pagamentos'] }, agora);
    assert.equal(semFinanceiro.notificacoes.length, 0);
    assert.equal(listarNotificacoes(banco, { ...a.usuario, perfil: 'Administrador' }, agora).notificacoes.length, 12);
  } finally { banco.fechar(); }
});

test('portal recebe somente avisos permitidos e materiais do destinatário correto', () => {
  const banco = abrirBanco(':memory:');
  try {
    const a = cenario(banco);
    const b = cenario(banco, 'professor-b');
    const compartilhar = (alunoId: string, destinatario: string, materialId: string, data = agora.toISOString()) => banco.db.prepare('INSERT INTO compartilhamentos VALUES (?,?,?,?,?,?)').run(randomUUID(), materialId, alunoId, destinatario, data, a.usuario.id);
    compartilhar(a.aluno.id, 'Aluno', a.material.id);
    compartilhar(a.aluno.id, 'Responsável', a.material.id);
    compartilhar(b.aluno.id, 'Aluno', b.material.id);
    compartilhar(a.aluno.id, 'Aluno', b.material.id, '2026-09-01T12:00:00Z');
    const aluno: Usuario = { ...a.usuario, id: randomUUID(), perfil: 'Aluno', alunoId: a.aluno.id, professorId: '', permissoes: [] };
    const responsavel: Usuario = { ...aluno, id: randomUUID(), perfil: 'Responsável' };
    const avisosAluno = listarNotificacoes(banco, aluno, agora);
    assert.equal(avisosAluno.naoLidas, 2);
    assert.deepEqual(new Set(avisosAluno.notificacoes.map(n => n.tipo)), new Set(['aula', 'material']));
    assert.equal(listarNotificacoes(banco, responsavel, agora).naoLidas, 4);
    marcarNotificacoes(banco, aluno, undefined, agora);
    assert.equal(listarNotificacoes(banco, responsavel, agora).naoLidas, 4);
    assert.throws(() => marcarNotificacoes(banco, responsavel, avisosAluno.notificacoes.find(n => n.tipo === 'material')!.id, agora), /não encontrada/);
  } finally { banco.fechar(); }
});

test('resolve pendências, expira novidades e cria novo aviso quando pagamento atrasa', () => {
  const banco = abrirBanco(':memory:');
  try {
    const c = cenario(banco);
    const lista = listarNotificacoes(banco, c.usuario, agora);
    marcarNotificacoes(banco, c.usuario, undefined, agora);
    const futuro = new Date('2026-09-29T12:00:00Z');
    const nova = listarNotificacoes(banco, c.usuario, futuro);
    assert.equal(nova.naoLidas, 1);
    assert.ok(nova.notificacoes.some(n => !n.lida && n.titulo === 'Pagamento atrasado'));
    banco.salvar('pagamentos', { ...c.pagamento.dados, status: 'Recebido' }, c.usuario, c.pagamento.id, c.pagamento.versao);
    banco.salvar('planejamentos', { aulaId: c.aula.id, professorId: c.usuario.professorId }, c.usuario);
    banco.salvar('aulas', { ...c.aula.dados, status: 'Cancelada pelo aluno' }, c.usuario, c.aula.id, c.aula.versao);
    banco.salvar('materiais', { ...c.material.dados, status: 'Inativo' }, c.usuario, c.material.id, c.material.versao);
    banco.db.prepare('DELETE FROM registros WHERE id=?').run(c.avaliacao.id);
    assert.equal(listarNotificacoes(banco, c.usuario, agora).notificacoes.length, 1);
    assert.throws(() => marcarNotificacoes(banco, c.usuario, lista.notificacoes.find(n => n.tipo === 'aula')!.id, agora), /não encontrada/);
    const antigo = banco.salvar('avaliacoes', { alunoId: c.aluno.id, professorId: c.usuario.professorId, nome: 'Avaliação antiga' }, c.usuario);
    banco.db.prepare('UPDATE historico SET data=? WHERE registroId=?').run('2026-08-01T12:00:00Z', antigo.id);
    assert.equal(listarNotificacoes(banco, c.usuario, agora).notificacoes.length, 1);
  } finally { banco.fechar(); }
});

test('leitura persiste ao reabrir o banco e contas vazias não recebem avisos', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'educonnect-notificacoes-'));
  const caminho = join(pasta, 'teste.sqlite');
  let banco = abrirBanco(caminho);
  try {
    const c = cenario(banco);
    marcarNotificacoes(banco, c.usuario, undefined, agora);
    banco.fechar();
    banco = abrirBanco(caminho);
    assert.equal(listarNotificacoes(banco, c.usuario, agora).naoLidas, 0);
    assert.equal(listarNotificacoes(banco, { ...c.usuario, id: randomUUID(), professorId: 'sem-alunos' }, agora).notificacoes.length, 0);
  } finally { banco.fechar(); rmSync(pasta, { recursive: true, force: true }); }
});

test('rotas HTTP exigem sessão, rejeitam aviso inexistente e aceitam lista vazia', async () => {
  const server = criarServidor(':memory:');
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  let cookie = '';
  async function req(path: string, method = 'GET', body?: unknown) {
    return fetch(base + path, { method, headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  try {
    assert.equal((await req('/notificacoes')).status, 401);
    assert.equal((await req('/notificacoes/lidas', 'PUT', {})).status, 401);
    await req('/auth/inicial', 'POST', { nome: 'Admin teste', email: 'admin@example.test', senha: 'SenhaTeste123' });
    const entrada = await req('/auth/entrar', 'POST', { email: 'admin@example.test', senha: 'SenhaTeste123' });
    cookie = entrada.headers.get('set-cookie')!.split(';')[0];
    assert.deepEqual(await (await req('/notificacoes')).json(), { notificacoes: [], naoLidas: 0 });
    assert.equal((await req('/notificacoes/lidas', 'PUT', {})).status, 200);
    assert.equal((await req('/notificacoes/' + 'a'.repeat(64) + '/lida', 'PUT', {})).status, 404);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
