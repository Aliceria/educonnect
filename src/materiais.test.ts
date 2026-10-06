import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { fontesDoBanco } from './integracao.ts';
import { validarMaterial, guardarAnexo, compartilharMaterial, listarCompartilhamentos } from './modulos/Materiais.ts';
import { meusDados } from './modulos/AreaProfessor.ts';
import { criarServidor } from './servidor.ts';

const pdf = Buffer.from('%PDF-1.4\nArquivo de teste\n%%EOF');
function cenario(caminho = ':memory:') {
  const banco = abrirBanco(caminho);
  const usuario: Usuario = { id: 'docente', nome: 'Professor Teste', email: 'prof@example.test',
    perfil: 'Professor', professorId: 'professor', permissoes: ['materiais'], ativo: true };
  const aluno = banco.salvar('alunos', { nome: 'Aluno Teste', professorId: 'professor', status: 'Ativo', responsavel: 'Mãe' }, usuario);
  const outro = banco.salvar('alunos', { nome: 'Outro Aluno', professorId: 'professor', status: 'Ativo' }, usuario);
  const aula = banco.salvar('aulas', { alunoId: aluno.id, professorId: 'professor', data: '2026-10-06', hora: '10:00' }, usuario);
  const disciplina = banco.salvar('disciplinas', { nome: 'Matemática' }, usuario);
  const fontes = fontesDoBanco(banco);
  const dados = { nome: 'Exercícios', descricao: 'Revisão de frações', tipo: 'PDF', disciplinaId: disciplina.id,
    conteudoId: '', alunoId: aluno.id, aulaId: aula.id, link: '', status: 'Ativo' };
  const material = banco.salvar('materiais', validarMaterial(dados, banco, usuario, fontes), usuario);
  return { banco, usuario, aluno, outro, aula, disciplina, fontes, dados, material };
}

test('material valida os vínculos e conserva os bytes do arquivo sem aceitar upload incompleto', () => {
  const c = cenario();
  try {
    assert.equal(c.material.dados.professorId, c.usuario.professorId);
    assert.equal(validarMaterial({ ...c.dados, alunoId: '' }, c.banco, c.usuario, c.fontes).alunoId, c.aluno.id);
    assert.throws(() => validarMaterial({ ...c.dados, alunoId: c.outro.id }, c.banco, c.usuario, c.fontes), /outro aluno/);
    assert.throws(() => validarMaterial({ ...c.dados, aulaId: 'inexistente' }, c.banco, c.usuario, c.fontes), /Aula não disponível/);
    assert.throws(() => validarMaterial({ ...c.dados, link: 'javascript:alert(1)' }, c.banco, c.usuario, c.fontes), /HTTP/);
    const base64 = pdf.toString('base64');
    guardarAnexo(c.banco, c.usuario, c.material.id, { nome: 'lista.pdf', base64 });
    const ler = () => c.banco.db.prepare('SELECT * FROM anexos WHERE registroId=?').get(c.material.id)!;
    assert.deepEqual(Buffer.from(ler().conteudo as Uint8Array), pdf);
    for (const invalido of [base64.slice(0, -1), 'JVBERi0=garbage', Buffer.from('texto').toString('base64')])
      assert.throws(() => guardarAnexo(c.banco, c.usuario, c.material.id, { nome: 'lista.pdf', base64: invalido }));
    assert.throws(() => guardarAnexo(c.banco, c.usuario, c.material.id,
      { nome: 'grande.pdf', base64: Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]).toString('base64') }), /5 MB/);
    assert.deepEqual(Buffer.from(ler().conteudo as Uint8Array), pdf);
    assert.throws(() => guardarAnexo(c.banco, { ...c.usuario, permissoes: [] }, c.material.id,
      { nome: 'lista.pdf', base64 }), /permissão/);
    const limite = Buffer.alloc(5 * 1024 * 1024); pdf.copy(limite);
    assert.equal(guardarAnexo(c.banco, c.usuario, c.material.id,
      { nome: 'limite.pdf', base64: limite.toString('base64') }).tamanho, limite.length);
    assert.throws(() => c.banco.buscar('materiais', c.material.id, { ...c.usuario, id: 'outro', professorId: 'outro' }), /permissão/);
    const legado = { ...c.material.dados }; delete legado.alunoId; delete legado.professorId;
    c.banco.salvar('materiais', legado, c.usuario, c.material.id, c.material.versao);
    compartilharMaterial(c.banco, c.usuario, c.material.id, {alunoId: c.aluno.id, destinatario: 'Aluno'}, c.fontes);
    assert.equal(validarMaterial({ ...c.dados, alunoId: '', descricao: 'Descrição atualizada' },
      c.banco, c.usuario, c.fontes, c.material.id).alunoId, c.aluno.id);
  } finally { c.banco.fechar(); }
});

test('compartilhamento não duplica registros, preserva autoria e histórico e separa os destinatários', () => {
  const c = cenario();
  try {
    const compartilhar = (alunoId = c.aluno.id, destinatario = 'Aluno') =>
      compartilharMaterial(c.banco, c.usuario, c.material.id, { alunoId, destinatario }, c.fontes);
    assert.throws(() => compartilhar(), /arquivo ou link/);
    guardarAnexo(c.banco, c.usuario, c.material.id, { nome: 'lista.pdf', base64: pdf.toString('base64') });
    assert.throws(() => compartilhar(c.outro.id), /outro aluno/);
    const primeiro = compartilhar();
    assert.equal(compartilhar().caminho, primeiro.caminho);
    assert.equal(c.banco.db.prepare('SELECT count(*) n FROM compartilhamentos').get()!.n, 1);
    const historico = listarCompartilhamentos(c.banco, c.usuario);
    assert.equal(historico[0].autor, 'Professor Teste');
    assert.equal(historico[0].autorId, c.usuario.id);
    assert.equal(historico[0].disciplina, 'Matemática');
    assert.equal(historico[0].aula, '2026-10-06T10:00');
    assert.ok(Number.isFinite(Date.parse(historico[0].data)));
    const aluno: Usuario = { ...c.usuario, id: 'portal', perfil: 'Aluno', alunoId: c.aluno.id, professorId: '', permissoes: [] };
    assert.equal(meusDados(c.banco, aluno).materiais.length, 1);
    assert.equal(meusDados(c.banco, { ...aluno, alunoId: c.outro.id }).materiais.length, 0);
    assert.equal(meusDados(c.banco, { ...aluno, perfil: 'Responsável' }).materiais.length, 0);
    compartilhar(c.aluno.id, 'Responsável');
    assert.equal(meusDados(c.banco, { ...aluno, perfil: 'Responsável' }).materiais.length, 1);
    const atualizado = validarMaterial({ ...c.dados, nome: 'Lista atualizada', descricao: 'Descrição atualizada' },
      c.banco, c.usuario, c.fontes, c.material.id);
    c.banco.salvar('materiais', atualizado, c.usuario, c.material.id, c.material.versao);
    assert.equal(meusDados(c.banco, aluno).materiais[0].nome, 'Lista atualizada');
    assert.equal(listarCompartilhamentos(c.banco, c.usuario)[0].nome, 'Exercícios');
    assert.throws(() => validarMaterial({ ...c.dados, alunoId: c.outro.id, aulaId: '' },
      c.banco, c.usuario, c.fontes, c.material.id), /já foi compartilhado/);
    c.banco.db.prepare('UPDATE compartilhamentos SET data=?').run('2020-01-01T00:00:00Z');
    assert.equal(meusDados(c.banco, aluno).materiais.length, 0);
    assert.equal(meusDados(c.banco, aluno).historicoMateriais[0].situacao, 'Expirado');
    assert.notEqual(compartilhar().caminho, primeiro.caminho);
    assert.equal(listarCompartilhamentos(c.banco, c.usuario).length, 3);
    assert.deepEqual(listarCompartilhamentos(c.banco, { ...c.usuario, id: 'outro', professorId: 'outro' }), []);
  } finally { c.banco.fechar(); }
});

test('arquivos e histórico de materiais persistem ao reabrir o banco', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'educonnect-materiais-'));
  const caminho = join(pasta, 'teste.sqlite');
  const c = cenario(caminho);
  let banco = c.banco;
  try {
    guardarAnexo(banco, c.usuario, c.material.id, { nome: 'lista.pdf', base64: pdf.toString('base64') });
    compartilharMaterial(banco, c.usuario, c.material.id, { alunoId: c.aluno.id, destinatario: 'Aluno' }, c.fontes);
    banco.fechar(); banco = abrirBanco(caminho);
    assert.equal(listarCompartilhamentos(banco, c.usuario)[0].autor, c.usuario.nome);
    assert.deepEqual(Buffer.from(banco.db.prepare('SELECT conteudo FROM anexos WHERE registroId=?')
      .get(c.material.id)!.conteudo as Uint8Array), pdf);
  } finally { banco.fechar(); rmSync(pasta, { recursive: true, force: true }); }
});

test('API salva material e upload juntos, protege o acesso e evita compartilhamentos simultâneos duplicados', async () => {
  const servidor = criarServidor(':memory:');
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  const endereco = servidor.address(); assert.ok(endereco && typeof endereco !== 'string');
  const base = `http://127.0.0.1:${endereco.port}/api`;
  let admin = '';
  async function req(path: string, method = 'GET', body?: unknown, cookie = admin) {
    const r = await fetch(base + path, { method, headers: {Cookie: cookie,
      ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      body: body === undefined ? undefined : JSON.stringify(body) });
    return {status: r.status, data: r.headers.get('content-type')?.includes('application/pdf')
      ? Buffer.from(await r.arrayBuffer()) : await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] ?? ''};
  }
  try {
    await req('/auth/inicial', 'POST', {nome: 'Admin Teste', email: 'admin@example.test', senha: 'SenhaTeste123'});
    admin = (await req('/auth/entrar', 'POST', {email: 'admin@example.test', senha: 'SenhaTeste123'})).cookie;
    const prof = (await req('/professores', 'POST', {nome: 'Professor Teste', contato: '11987654321',
      email: 'prof@example.test', disciplinas: ['Matemática'], valorHora: 100, modalidade: 'Presencial',
      horarios: [{dia: 1, inicio: '08:00', fim: '18:00'}], endereco: '', recebimento: '', perfil: 'Professor', ativo: true})).data;
    const aluno = (await req('/registros/alunos', 'POST', {dados: {nome: 'Aluno Teste', idade: 20,
      professorId: prof.id, telefone: '', email: '', responsavel: '', contatoResponsavel: '', emailResponsavel: '',
      parentesco: '', autorizacao: '', escola: '', serie: '', disciplina: 'Matemática', dificuldade: '', objetivo: 'Reforço',
      modalidade: 'Presencial', endereco: '', disponibilidade: '', observacoes: '', status: 'Ativo'}})).data;
    const disciplina = (await req('/registros/disciplinas', 'POST', {dados: {nome: 'Matemática', descricao: '', status: 'Ativa'}})).data;
    const dados = {nome: 'Lista', descricao: 'Frações', disciplinaId: disciplina.id, conteudoId: '',
      aulaId: '', alunoId: aluno.id, link: '', tipo: 'PDF', status: 'Ativo'};
    assert.equal((await req('/registros/materiais', 'POST', {dados, anexo: {nome: 'ruim.pdf', base64: 'texto'}})).status, 400);
    assert.equal((await req('/registros/materiais')).data.length, 0);
    const criado = await req('/registros/materiais', 'POST', {dados, anexo: {nome: 'lista.pdf', base64: pdf.toString('base64')}});
    assert.equal(criado.status, 201); const id = criado.data.id;
    assert.equal((await req('/registros/materiais')).data[0].anexo.nome, 'lista.pdf');
    assert.deepEqual((await req(`/materiais/${id}/anexo`)).data, pdf);
    assert.equal((await req(`/materiais/${id}/anexo`, 'GET', undefined, '')).status, 401);
    const novo = {dados: {...dados, descricao: 'Atualizada'}, versao: criado.data.versao};
    assert.equal((await req('/registros/materiais/' + id, 'PUT', {...novo, anexo: {nome: 'ruim.pdf', base64: 'texto'}})).status, 400);
    assert.equal((await req('/registros/materiais/' + id)).data.dados.descricao, 'Frações');
    assert.equal((await req('/registros/materiais/' + id, 'PUT', {...novo, versao: 999})).status, 409);
    const [um, dois] = await Promise.all([1, 2].map(() => req(`/materiais/${id}/compartilhar`, 'POST',
      {alunoId: aluno.id, destinatario: 'Aluno'})));
    assert.equal(um.status, 201); assert.equal(um.data.caminho, dois.data.caminho);
    const historia = (await req('/materiais/compartilhamentos')).data;
    assert.equal(historia.length, 1); assert.equal(historia[0].autor, 'Admin Teste');
    assert.equal((await req('/usuarios', 'POST', {nome: 'Aluno Teste', email: 'aluno@example.test', senha: 'SenhaTeste123',
      perfil: 'Aluno', alunoId: aluno.id, professorId: '', permissoes: [], ativo: true})).status, 201);
    const portal = (await req('/auth/entrar', 'POST', {email: 'aluno@example.test', senha: 'SenhaTeste123'})).cookie;
    assert.equal((await req('/meus-dados', 'GET', undefined, portal)).data.materiais[0].descricao, 'Frações');
    assert.deepEqual((await req(um.data.caminho.replace('/api', ''), 'GET', undefined, portal)).data, pdf);
    assert.equal((await req('/materiais/compartilhamentos', 'GET', undefined, portal)).status, 403);
    assert.equal((await req(`/materiais/${id}/anexo`, 'GET', undefined, portal)).status, 403);
    await req('/usuarios', 'POST', {nome: 'Professor Teste', email: 'docente@example.test', senha: 'SenhaTeste123',
      perfil: 'Professor', professorId: prof.id, permissoes: ['materiais'], ativo: true});
    const docente = (await req('/auth/entrar', 'POST', {email: 'docente@example.test', senha: 'SenhaTeste123'})).cookie;
    const referencias = await req('/materiais/referencias', 'GET', undefined, docente);
    assert.deepEqual(referencias.data.disciplinas, [{id: disciplina.id, dados: {nome: 'Matemática'}}]);
    assert.equal((await req('/registros/materiais/' + id, 'PUT', novo, docente)).status, 200);
    assert.equal((await req(`/materiais/${id}/compartilhar`, 'POST', {alunoId: aluno.id, destinatario: 'Aluno'}, docente)).data.caminho, um.data.caminho);
    await req('/usuarios', 'POST', {nome: 'Restrito', email: 'restrito@example.test', senha: 'SenhaTeste123',
      perfil: 'Professor', professorId: prof.id, permissoes: ['dashboard'], ativo: true});
    const restrito = (await req('/auth/entrar', 'POST', {email: 'restrito@example.test', senha: 'SenhaTeste123'})).cookie;
    for (const path of ['/registros/materiais', '/materiais/compartilhamentos', '/materiais/referencias', `/materiais/${id}/anexo`])
      assert.equal((await req(path, 'GET', undefined, restrito)).status, 403);
  } finally { await new Promise<void>((resolve, reject) => servidor.close(e => e ? reject(e) : resolve())); }
});
