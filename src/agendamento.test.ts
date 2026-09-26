import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from './servidor.ts';
import { limitesPeriodo, navegarData, formatarData } from '../public/agenda/datas.ts';
import { horarioForaDisponibilidade } from '../public/agenda/auxiliares.ts';

test('aviso de disponibilidade aceita duração digitada como texto', () => {
  const refs = { alunos: [{ id: 'a', professorId: 'p' }], professores: [{ id: 'p', horarios: [{ dia: 1, inicio: '08:00', fim: '09:00' }] }] };
  assert.equal(horarioForaDisponibilidade({ alunoId: 'a', data: '2026-01-05', hora: '15:00', duracaoMinutos: '60' }, refs), true);
  assert.equal(horarioForaDisponibilidade({ alunoId: 'a', data: '2026-01-05', hora: '08:00', duracaoMinutos: '60' }, refs), false);
});

test('períodos cobrem segunda a domingo, fevereiro bissexto e virada do ano', () => {
  assert.deepEqual(limitesPeriodo('2026-09-27', 'Semana'), { inicio: '2026-09-21', fim: '2026-09-27' });
  assert.deepEqual(limitesPeriodo('2024-02-15', 'Mês'), { inicio: '2024-02-01', fim: '2024-02-29' });
  assert.deepEqual(limitesPeriodo('2026-09-26', 'Dia'), { inicio: '2026-09-26', fim: '2026-09-26' });
  assert.equal(navegarData('2024-01-31', 'Mês', 1), '2024-02-29');
  assert.equal(navegarData('2026-01-01', 'Dia', -1), '2025-12-31');
  assert.equal(navegarData('2026-09-27', 'Semana', 1), '2026-10-04');
  assert.equal(formatarData('2026-09-26'), '26/09/2026');
});

test('API persiste dados da aula e protege exclusão, vínculos, saldo e permissões', async () => {
  const server = criarServidor(':memory:');
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  let cookie = '';
  async function request(path: string, method = 'GET', body?: unknown, session = cookie) {
    const response = await fetch(base + path, { method, headers: {
      Cookie: session, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  async function create(tipo: string, dados: unknown) {
    const r = await request('/registros/' + tipo, 'POST', { dados });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
  }
  try {
    await request('/auth/inicial', 'POST', { nome: 'Admin Teste', email: 'admin@example.test', senha: 'SenhaTeste123' });
    cookie = (await request('/auth/entrar', 'POST', { email: 'admin@example.test', senha: 'SenhaTeste123' })).cookie;
    const prof = await request('/professores', 'POST', { nome: 'Professor Teste', contato: '11987654321', email: 'prof@example.test', disciplinas: ['Matemática'], valorHora: 100, modalidade: 'Presencial', horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }], endereco: '', recebimento: '', perfil: 'Professor', ativo: true });
    assert.equal(prof.status, 201);
    const aluno = await create('alunos', { nome: 'Aluno Teste', idade: 20, professorId: prof.data.id, telefone: '', email: '', responsavel: '', contatoResponsavel: '', emailResponsavel: '', parentesco: '', autorizacao: '', escola: '', serie: '', disciplina: 'Matemática', dificuldade: '', objetivo: 'Reforço', modalidade: 'Presencial', endereco: '', disponibilidade: '', observacoes: '', status: 'Ativo' });
    const pacote = await create('pacotes', { nome: 'Pacote', alunoId: aluno.id, quantidade: 4, valor: 400, politicaFalta: 'Cobrar', politicaCancelamento: 'Cobrar' });
    const dados = { alunoId: aluno.id, data: '2026-01-05', hora: '10:00', duracaoMinutos: 60, status: 'Realizada', modalidade: 'On-line', disciplina: 'Álgebra', observacoes: 'Revisar equações', pacoteId: pacote.id, originalId: '', conteudos: '', link: '', justificativa: '' };
    const aula = await create('aulas', dados);
    assert.equal(aula.dados.modalidade, 'On-line');
    assert.equal(aula.dados.disciplina, 'Álgebra');
    assert.equal(aula.dados.observacoes, 'Revisar equações');
    assert.equal((await request('/saldos')).data[0].restantes, 3);
    assert.equal((await request('/registros/aulas', 'POST', { dados: { ...dados, hora: '12:00', modalidade: 'Híbrida' } })).status, 400);
    assert.equal((await request('/registros/aulas', 'POST', { dados: { ...dados, hora: '12:00', status: 'Reposição' } })).status, 400);
    assert.equal((await request('/registros/aulas/' + aula.id, 'DELETE', { versao: aula.versao }, '')).status, 401);
    await request('/usuarios', 'POST', { nome: 'Sem Agenda', email: 'restrito@example.test', senha: 'SenhaTeste123', perfil: 'Professor', professorId: prof.data.id, ativo: true, permissoes: ['dashboard'] });
    const restrito = (await request('/auth/entrar', 'POST', { email: 'restrito@example.test', senha: 'SenhaTeste123' })).cookie;
    assert.equal((await request('/registros/aulas/' + aula.id, 'DELETE', { versao: aula.versao }, restrito)).status, 403);
    assert.equal((await request('/registros/aulas/' + aula.id, 'DELETE', { versao: 999 })).status, 409);
    assert.equal((await request('/registros/aulas/' + aula.id, 'DELETE', { versao: aula.versao })).status, 200);
    assert.equal((await request('/registros/presencas')).data.length, 0);
    assert.equal((await request('/saldos')).data[0].restantes, 4);
    assert.equal((await request('/registros/aulas/' + aula.id)).status, 404);
    const original = await create('aulas', { ...dados, status: 'Agendada' });
    const plano = await create('planejamentos', { aulaId: original.id, previsto: 'Revisão', objetivos: 'Aprender', atividades: '', conteudos: '', materiais: '', trabalhado: '', tarefa: '', retomar: '' });
    assert.ok(plano.id);
    assert.equal((await request('/registros/aulas/' + original.id, 'DELETE', { versao: original.versao })).status, 409);
    const cancelada = await create('aulas', { ...dados, hora: '14:00', status: 'Cancelada pelo professor' });
    const reposicao = await create('aulas', { ...dados, hora: '15:00', status: 'Reposição', originalId: cancelada.id });
    assert.equal(reposicao.dados.status, 'Agendada');
    assert.equal(reposicao.dados.originalId, cancelada.id);
    assert.equal((await request('/registros/aulas/' + cancelada.id, 'DELETE', { versao: cancelada.versao })).status, 409);
    const remarcada = await request('/aulas/' + reposicao.id + '/reagendar', 'POST', { data: '2026-01-06', hora: '15:00', versao: reposicao.versao });
    assert.equal(remarcada.status, 201);
    assert.equal(remarcada.data.dados.modalidade, 'On-line');
    assert.equal(remarcada.data.dados.observacoes, 'Revisar equações');
    for (const [i, status] of ['Realizada', 'Falta', 'Falta justificada', 'Falta do professor', 'Cancelada pelo aluno', 'Cancelada pelo professor'].entries()) {
      const registro = await create('aulas', { ...dados, data: `2026-02-${String(i + 1).padStart(2, '0')}`, status, pacoteId: '', justificativa: 'Motivo informado' });
      assert.equal(registro.dados.status, status);
    }
    assert.ok((await request('/historico?modulo=aulas')).data.some((e: { acao: string }) => e.acao === 'Exclusão'));
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
