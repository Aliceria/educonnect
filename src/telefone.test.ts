import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefone } from './telefone.ts';
import { validarAluno } from './modulos/Alunos.ts';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { abrirProfessores, ErroCadastro } from './modulos/Professores.ts';

test('aceita telefone opcional e normaliza fixo, celular e código do Brasil', () => {
  for (const [entrada, esperado] of [
    ['', ''], ['  ', ''], ['(11) 3456-7890', '1134567890'],
    ['(11) 99999-9999', '11999999999'], ['+55 (11) 99999-9999', '5511999999999'],
    ['553499999999', '553499999999'],
  ]) assert.equal(normalizarTelefone(entrada), esperado);
});

test('rejeita letras, símbolos, tamanho incorreto e prefixos inválidos', () => {
  for (const entrada of ['abc @#$', 'abc11999999999', '11999999999!', '123',
    '1199999999999999', '+1 202 555 0123', '00999999999', '+11999999999'])
    assert.throws(() => normalizarTelefone(entrada));
});

test('cadastro no servidor rejeita telefone inválido mesmo sem validação da interface', () => {
  const banco = abrirBanco(':memory:');
  try {
    abrirProfessores(banco.db);
    banco.db.prepare('INSERT INTO professores (id,email,versao,cadastro) VALUES (?,?,?,?)')
      .run('prof', 'prof@example.com', 1, JSON.stringify({ ativo: true }));
    const usuario: Usuario = { id: 'qa', nome: 'QA', email: '', perfil: 'Administrador',
      professorId: '', permissoes: [], ativo: true };
    const dados = { professorId: 'prof', idade: 20, nome: 'Aluno', telefone: 'abc @#$',
      responsavel: '', contatoResponsavel: '', email: '', emailResponsavel: '', parentesco: '',
      autorizacao: '', escola: '', serie: '', disciplina: 'Matemática', dificuldade: '',
      objetivo: 'Reforço', modalidade: 'Presencial', endereco: '', disponibilidade: '',
      observacoes: '', status: 'Ativo' };
    assert.throws(() => validarAluno(dados, banco, usuario),
      (erro: unknown) => erro instanceof ErroCadastro && erro.status === 400);
    assert.equal(validarAluno({ ...dados, telefone: '(11) 99999-9999' }, banco, usuario).telefone,
      '11999999999');
    assert.equal(validarAluno({ ...dados, telefone: '' }, banco, usuario).telefone, '');
  } finally {
    banco.fechar();
  }
});
