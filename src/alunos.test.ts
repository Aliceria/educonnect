import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { validarAluno } from './modulos/Alunos.ts';
import { abrirProfessores } from './modulos/Professores.ts';
import { criarServidor } from './servidor.ts';

function cenario() {
  const banco = abrirBanco(':memory:');
  const professor = abrirProfessores(banco.db).criar({
    nome: 'Professor Um',
    contato: '11987654321',
    email: 'professor@example.test',
    disciplinas: ['Matemática'],
    valorHora: 100,
    modalidade: 'Presencial',
    horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }],
    endereco: 'Rua A, 10',
    recebimento: 'Pix',
    perfil: 'Professor',
    ativo: true,
  });
  const usuario: Usuario = {
    id: 'professor',
    nome: 'Professor Um',
    email: 'professor@example.test',
    perfil: 'Professor',
    professorId: professor.id,
    permissoes: ['alunos'],
    ativo: true,
  };
  const aluno = {
    nome: 'Ana Souza',
    idade: 14,
    telefone: '',
    email: '',
    responsavel: 'Maria Souza',
    contatoResponsavel: '11987654321',
    emailResponsavel: '',
    parentesco: 'Mãe',
    autorizacao: '',
    escola: 'Escola Central',
    serie: '7º ano do ensino fundamental',
    disciplina: 'Matemática',
    dificuldade: '',
    objetivo: 'Reforço',
    modalidade: 'Presencial',
    endereco: 'Rua B, 100',
    disponibilidade: '',
    observacoes: '',
    status: 'Ativo',
  };
  return { banco, usuario, aluno, professor };
}

test('endereço é obrigatório nas modalidades presencial e híbrida', () => {
  const { banco, usuario, aluno } = cenario();
  try {
    assert.equal(validarAluno(aluno, banco, usuario).endereco, 'Rua B, 100');
    assert.equal(validarAluno(aluno, banco, usuario).idade, 14);
    assert.throws(() => validarAluno({ ...aluno, idade: 15.5 }, banco, usuario), /idade inteira/);
    assert.throws(() => validarAluno({ ...aluno, endereco: '' }, banco, usuario), /endereço/);
    assert.throws(() => validarAluno({ ...aluno, endereco: '   ' }, banco, usuario), /endereço/);
    assert.throws(
      () => validarAluno({ ...aluno, modalidade: 'Híbrida', endereco: '' }, banco, usuario),
      /endereço/,
    );
    assert.equal(
      validarAluno({ ...aluno, modalidade: 'On-line', endereco: '' }, banco, usuario).endereco,
      '',
    );
    assert.equal(
      validarAluno({ ...aluno, modalidade: 'On-line', endereco: 'Rua C, 25' }, banco, usuario)
        .endereco,
      'Rua C, 25',
    );
    assert.throws(
      () => validarAluno({ ...aluno, modalidade: 'Domiciliar' }, banco, usuario),
      /modalidade|Opção inválida/,
    );
  } finally {
    banco.fechar();
  }
});

test('API bloqueia cadastro presencial sem endereço e aceita on-line', async () => {
  const servidor = criarServidor(':memory:');
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco !== 'string');
  const base = `http://127.0.0.1:${endereco.port}/api`;
  let cookie = '';
  async function req(caminho: string, metodo = 'GET', corpo?: unknown, sessao = cookie) {
    const resposta = await fetch(base + caminho, {
      method: metodo,
      headers: {
        Cookie: sessao,
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return {
      status: resposta.status,
      dados: await resposta.json().catch(() => null),
      cookie: (resposta.headers.get('set-cookie') ?? '').split(';')[0],
    };
  }
  try {
    await req('/auth/inicial', 'POST', {
      nome: 'Admin Teste',
      email: 'admin@example.test',
      senha: 'SenhaTeste123',
    });
    cookie = (
      await req('/auth/entrar', 'POST', { email: 'admin@example.test', senha: 'SenhaTeste123' }, '')
    ).cookie;
    assert.ok(cookie);
    const professor = await req('/professores', 'POST', {
      nome: 'Professor Um',
      contato: '11987654321',
      email: 'professor@example.test',
      disciplinas: ['Matemática'],
      valorHora: 100,
      modalidade: 'Presencial',
      horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }],
      endereco: 'Rua A, 10',
      recebimento: 'Pix',
      perfil: 'Professor',
      ativo: true,
    });
    assert.equal(professor.status, 201, JSON.stringify(professor.dados));
    const dados = {
      nome: 'Ana Souza',
      idade: 14,
      professorId: professor.dados.id,
      telefone: '',
      email: '',
      responsavel: 'Maria Souza',
      contatoResponsavel: '11987654321',
      emailResponsavel: '',
      parentesco: 'Mãe',
      autorizacao: '',
      escola: 'Escola Central',
      serie: '7º ano do ensino fundamental',
      disciplina: 'Matemática',
      dificuldade: '',
      objetivo: 'Reforço',
      modalidade: 'Presencial',
      endereco: '',
      disponibilidade: '',
      observacoes: '',
      status: 'Ativo',
    };
    const semEndereco = await req('/registros/alunos', 'POST', { dados });
    assert.equal(semEndereco.status, 400);
    assert.match(semEndereco.dados.erro, /endereço/);
    const idadeDecimal = await req('/registros/alunos', 'POST', {
      dados: { ...dados, endereco: 'Rua B, 100', idade: 15.01 },
    });
    assert.equal(idadeDecimal.status, 400);
    assert.match(idadeDecimal.dados.erro, /idade inteira/);
    const hibrida = await req('/registros/alunos', 'POST', {
      dados: { ...dados, modalidade: 'Híbrida' },
    });
    assert.equal(hibrida.status, 400);
    const online = await req('/registros/alunos', 'POST', {
      dados: { ...dados, modalidade: 'On-line' },
    });
    assert.equal(online.status, 201, JSON.stringify(online.dados));
    assert.equal(online.dados.dados.endereco, '');
    const presencial = await req('/registros/alunos', 'POST', {
      dados: { ...dados, endereco: 'Rua B, 100' },
    });
    assert.equal(presencial.status, 201, JSON.stringify(presencial.dados));
    assert.equal(presencial.dados.dados.endereco, 'Rua B, 100');
    const consulta = await req(`/registros/alunos/${presencial.dados.id}`);
    assert.equal(consulta.status, 200);
    assert.equal(consulta.dados.dados.endereco, 'Rua B, 100');
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((erro) => (erro ? reject(erro) : resolve())),
    );
  }
});
