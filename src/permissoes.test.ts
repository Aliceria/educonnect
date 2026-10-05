import test from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from './servidor.ts';
import { modulos, podeAcessar, podeGerarRelatorio } from './permissoes.ts';
import type { Usuario } from './banco.ts';

test('menu e servidor respeitam os perfis e o acesso financeiro', () => {
  const usuario: Usuario = { id: 'teste', nome: 'Teste', email: '', perfil: 'Professor',
    professorId: 'prof', permissoes: ['pagamentos', 'dashboard', 'seguranca'], ativo: true };
  assert.equal(podeAcessar(usuario, 'pagamentos'), false);
  assert.equal(podeAcessar(usuario, 'seguranca'), false);
  assert.equal(['pagamentos', 'dashboard'].find(modulo => podeAcessar(usuario, modulo)), 'dashboard');
  assert.equal(podeAcessar({ ...usuario, permissoes: ['pagamentos', 'financeiro'] }, 'pagamentos'), true);
  for (const perfil of ['Aluno', 'Responsável'] as const)
    assert.ok(modulos.every(modulo => !podeAcessar({ ...usuario, perfil, permissoes: modulos }, modulo)));
  assert.ok(modulos.every(modulo => podeAcessar({ ...usuario, perfil: 'Administrador' }, modulo)));
  assert.equal(podeGerarRelatorio({ ...usuario, permissoes: ['relatorios'] }, 'avaliacoes'), false);
});

async function cenario() {
  const servidor = criarServidor(':memory:');
  await new Promise<void>(resolve => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco !== 'string');
  const base = `http://127.0.0.1:${endereco.port}/api`;
  let admin = '';
  async function req(caminho: string, metodo = 'GET', corpo?: unknown, sessao = admin) {
    const resposta = await fetch(base + caminho, { method: metodo, headers: {
      Cookie: sessao, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: resposta.status,
      dados: resposta.headers.get('content-type')?.includes('application/pdf')
        ? await resposta.arrayBuffer() : await resposta.json(),
      cookie: resposta.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  async function entrar(email: string) {
    const r = await req('/auth/entrar', 'POST', { email, senha: 'SenhaTeste123' }, '');
    assert.equal(r.status, 200);
    return r.cookie;
  }
  async function criar(tipo: string, dados: unknown, sessao = admin) {
    const r = await req('/registros/' + tipo, 'POST', { dados }, sessao);
    assert.equal(r.status, 201, JSON.stringify(r.dados));
    return r.dados;
  }
  const fechar = () => new Promise<void>((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()));
  try {
    await req('/auth/inicial', 'POST', { nome: 'Admin Teste', email: 'admin@example.test', senha: 'SenhaTeste123' });
    admin = await entrar('admin@example.test');
    const professores = [];
    const alunos = [];
    for (const [indice, nome] of ['Um', 'Dois'].entries()) {
      const p = await req('/professores', 'POST', { nome: 'Professor ' + nome,
        contato: '11987654321', email: `prof${indice}@example.test`, disciplinas: ['Matemática'],
        valorHora: 100, modalidade: 'Presencial', horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }],
        endereco: 'Endereço reservado', recebimento: 'Chave reservada', perfil: 'Professor', ativo: true });
      assert.equal(p.status, 201);
      professores.push(p.dados);
      alunos.push(await criar('alunos', { nome: 'Aluno ' + nome, idade: 14, professorId: p.dados.id,
        telefone: '', email: '', responsavel: 'Responsável Teste', contatoResponsavel: '11987654321',
        emailResponsavel: '', parentesco: 'Mãe', autorizacao: '', escola: '', serie: '', disciplina: 'Matemática',
        dificuldade: '', objetivo: 'Reforço', modalidade: 'Presencial', endereco: '', disponibilidade: '',
        observacoes: '', status: 'Ativo' }));
      await criar('aulas', { alunoId: alunos[indice].id, data: '2026-01-05', hora: '10:00',
        duracaoMinutos: 60, status: 'Realizada', modalidade: 'Presencial', disciplina: 'Matemática',
        observacoes: '', pacoteId: '', originalId: '', conteudos: 'Conteúdo reservado', link: '', justificativa: '' });
      await criar('pagamentos', { nome: 'Mensalidade ' + nome, alunoId: alunos[indice].id,
        pacoteId: '', valor: 100, vencimento: '2026-01-10', recebidoEm: '', status: 'Pendente', forma: 'Pix', comprovante: '' });
    }
    const conta = { nome: 'Professor Um', email: 'docente@example.test', senha: 'SenhaTeste123',
      perfil: 'Professor', professorId: professores[0].id, ativo: true, permissoes: [...modulos] };
    const usuario = await req('/usuarios', 'POST', conta);
    assert.equal(usuario.status, 201);
    let professor = await entrar(conta.email);
    const disciplina = await criar('disciplinas', { nome: 'Matemática', descricao: 'Descrição reservada', status: 'Ativa' }, professor);
    await criar('avaliacoes', { nome: 'Prova', alunoId: alunos[0].id, disciplinaId: disciplina.id,
      data: '2026-01-05', nota: 8, notaMaxima: 10, mediaEscolar: 6, conteudos: '', dificuldades: '', reforcar: '' }, professor);
    async function alterar(permissoes: string[]) {
      const r = await req('/usuarios/' + usuario.dados.usuario.id, 'PUT', { ...conta, permissoes });
      assert.equal(r.status, 200);
      professor = await entrar(conta.email);
      return r.dados;
    }
    return { req, entrar, criar, fechar, professores, alunos, conta, usuario: usuario.dados.usuario,
      alterar, professor: () => professor };
  } catch (erro) { await fechar(); throw erro; }
}

test('permissões bloqueiam rotas diretas, consultas auxiliares e relatórios em PDF', async () => {
  const c = await cenario();
  try {
    assert.equal((await c.req('/registros/alunos', 'GET', undefined, '')).status, 401);
    const cookieAnterior = c.professor();
    await c.alterar(['relatorios']);
    assert.equal((await c.req('/auth/eu', 'GET', undefined, cookieAnterior)).status, 401);
    for (const rota of ['/registros/avaliacoes', '/relatorios?tipo=avaliacoes', '/relatorios/pdf?tipo=avaliacoes']) {
      const r = await c.req(rota, 'GET', undefined, c.professor());
      assert.equal(r.status, 403);
      assert.match(r.dados.erro, /permissão/);
    }
    const ref = (await c.req('/referencias', 'GET', undefined, c.professor())).dados;
    assert.equal(ref.alunos.length, 1);
    assert.deepEqual(ref.aulas, []);
    assert.deepEqual(ref.professores, []);
    assert.deepEqual(ref.pagamentos, []);
    assert.ok(!JSON.stringify(ref).includes('reservado'));
    await c.alterar([]);
    assert.ok(Object.values((await c.req('/referencias', 'GET', undefined, c.professor())).dados)
      .every(lista => Array.isArray(lista) && lista.length === 0));
    await c.alterar(['alunos', 'avaliacoes', 'relatorios']);
    assert.equal((await c.req('/relatorios?tipo=avaliacoes', 'GET', undefined, c.professor())).dados.linhas.length, 1);
    const pdf = await c.req('/relatorios/pdf?tipo=avaliacoes', 'GET', undefined, c.professor());
    assert.equal(pdf.status, 200);
    assert.ok(pdf.dados.byteLength > 0);
    assert.equal((await c.req('/relatorios?tipo=individual', 'GET', undefined, c.professor())).status, 403);
    const disciplinas = (await c.req('/registros/disciplinas', 'GET', undefined, c.professor())).dados;
    assert.deepEqual(disciplinas[0].dados, { nome: 'Matemática' });
    assert.equal((await c.req('/registros/alunos/' + c.alunos[1].id, 'GET', undefined, c.professor())).status, 404);
    assert.equal((await c.req('/registros/alunos/' + c.alunos[1].id, 'PUT', { dados: c.alunos[1].dados, versao: 1 }, c.professor())).status, 404);
    assert.equal((await c.req('/usuarios/' + c.usuario.id, 'PUT', { ...c.conta, perfil: 'Administrador' }, c.professor())).status, 403);
    assert.equal((await c.req('/usuarios', 'POST', { ...c.conta, email: 'outra@example.test' }, c.professor())).status, 403);
    await c.alterar(['alunos', 'agendamento', 'relatorios']);
    const aulas = (await c.req('/relatorios?tipo=aulas', 'GET', undefined, c.professor())).dados;
    assert.equal(aulas.linhas.length, 1);
    assert.equal(aulas.linhas[0][4], '');
    const refs = (await c.req('/referencias', 'GET', undefined, c.professor())).dados;
    assert.deepEqual(Object.keys(refs.aulas[0]).sort(), ['alunoId', 'data', 'id']);
    assert.ok(!JSON.stringify(refs).includes('reservado'));
    await c.alterar(['pagamentos']);
    assert.equal((await c.req('/registros/pagamentos', 'GET', undefined, c.professor())).status, 403);
    await c.alterar(['pagamentos', 'financeiro']);
    assert.equal((await c.req('/registros/pagamentos', 'GET', undefined, c.professor())).dados.length, 1);
    assert.equal((await c.req('/professores/' + c.professores[0].id + '/status', 'PATCH',
      { ativo: false, versao: c.professores[0].versao })).status, 200);
    assert.equal((await c.req('/auth/eu', 'GET', undefined, c.professor())).status, 401);
  } finally { await c.fechar(); }
});

test('aluno e responsável acessam seu vínculo e o último administrador fica preservado', async () => {
  const c = await cenario();
  try {
    for (const [indice, perfil] of ['Aluno', 'Responsável'].entries()) {
      const email = `portal${indice}@example.test`;
      const r = await c.req('/usuarios', 'POST', { nome: 'Portal Teste', email, senha: 'SenhaTeste123',
        perfil, alunoId: c.alunos[0].id, professorId: '', ativo: true, permissoes: [...modulos] });
      assert.equal(r.status, 201);
      assert.deepEqual(r.dados.usuario.permissoes, []);
      const sessao = await c.entrar(email);
      const area = (await c.req('/meus-dados', 'GET', undefined, sessao)).dados;
      assert.equal(area.aluno.nome, 'Aluno Um');
      assert.equal(area.aulas.length, 1);
      assert.equal(area.pagamentos.length, perfil === 'Responsável' ? 1 : 0);
      for (const rota of ['/registros/alunos', '/usuarios', '/referencias', '/relatorios?tipo=individual'])
        assert.equal((await c.req(rota, 'GET', undefined, sessao)).status, 403);
      await c.req('/auth/perfil', 'PUT', { nome: 'Portal Atualizado', email, telefone: '',
        perfil: 'Administrador', alunoId: c.alunos[1].id, permissoes: modulos }, sessao);
      const atual = (await c.req('/auth/eu', 'GET', undefined, sessao)).dados;
      assert.equal(atual.perfil, perfil);
      assert.equal(atual.alunoId, c.alunos[0].id);
    }
    const admin = (await c.req('/auth/eu')).dados;
    const editar = await c.req('/usuarios/' + admin.id, 'PUT', { ...admin, ativo: false });
    assert.equal(editar.status, 400);
    assert.equal((await c.req('/auth/eu')).status, 200);
    assert.equal((await c.req('/usuarios', 'POST', { ...c.conta, email: 'invalido@example.test',
      permissoes: ['inexistente'] })).status, 400);
  } finally { await c.fechar(); }
});
