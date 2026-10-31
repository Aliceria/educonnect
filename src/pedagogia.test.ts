import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { validarAcompanhamento } from './modulos/Acompanhamento.ts';
import { validarModelo, validarPlanejamento } from './modulos/Planejamento.ts';

test('acompanhamento valida nota, frequência, progresso e vínculo com a aula', () => {
  const banco = abrirBanco(':memory:');
  const usuario: Usuario = {
    id: 'professor',
    nome: 'Professor',
    email: '',
    perfil: 'Professor',
    professorId: 'professor',
    permissoes: ['acompanhamento'],
    ativo: true,
  };
  try {
    const aluno = banco.salvar('alunos', { nome: 'Aluno', professorId: 'professor', status: 'Ativo' }, usuario);
    const outroAluno = banco.salvar('alunos', { nome: 'Outro', professorId: 'professor', status: 'Ativo' }, usuario);
    const aula = banco.salvar('aulas', { alunoId: aluno.id, professorId: 'professor' }, usuario);
    const dados = {
      alunoId: aluno.id,
      aulaId: aula.id,
      data: '2026-10-01',
      tipo: 'Evolução',
      disciplina: 'Matemática',
      avaliacao: 'Frações',
      nota: 8.5,
      frequencia: 'Presente',
      evolucao: 'Resolveu os exercícios com autonomia.',
      pontosFortes: 'Boa interpretação',
      dificuldades: '',
      meta: 'Resolver problemas',
      objetivo: 'Consolidar frações',
      progressoMeta: 75,
      retomar: '',
    };

    assert.deepEqual(validarAcompanhamento(dados, banco, usuario), {
      ...dados,
      professorId: 'professor',
    });
    assert.throws(() => validarAcompanhamento({ ...dados, nota: 10.1 }, banco, usuario), /entre 0 e 10/);
    assert.throws(() => validarAcompanhamento({ ...dados, progressoMeta: -1 }, banco, usuario), /entre 0 e 100/);
    assert.throws(
      () => validarAcompanhamento({ ...dados, aulaId: aula.id, alunoId: outroAluno.id }, banco, usuario),
      /A aula pertence a outro aluno/,
    );
    assert.equal(validarAcompanhamento({
      alunoId: aluno.id, aulaId: '', data: '2026-10-02', tipo: 'Evolução', disciplina: '',
      avaliacao: '', nota: '', frequencia: '', evolucao: 'Acompanhamento legado atualizado.',
      pontosFortes: '', dificuldades: '', meta: '', objetivo: '', progressoMeta: '', retomar: '',
    }, banco, usuario).frequencia, 'Não se aplica');
  } finally {
    banco.fechar();
  }
});

test('planejamento conserva campos opcionais legados e valida os novos campos', () => {
  const banco = abrirBanco(':memory:');
  const usuario: Usuario = {
    id: 'professor',
    nome: 'Professor',
    email: '',
    perfil: 'Professor',
    professorId: 'professor',
    permissoes: ['planejamento'],
    ativo: true,
  };
  try {
    const aluno = banco.salvar('alunos', { nome: 'Aluno', professorId: 'professor', status: 'Ativo' }, usuario);
    const aula = banco.salvar('aulas', { nome: 'Aula', alunoId: aluno.id, professorId: 'professor' }, usuario);
    const legado = {
      aulaId: aula.id, previsto: 'Revisão', objetivos: 'Praticar', atividades: '',
      conteudos: '', materiais: '', trabalhado: '', tarefa: '', retomar: '',
    };
    const validadoLegado = validarPlanejamento(legado, banco, usuario);
    assert.equal(validadoLegado.metodologia, '');
    assert.equal(validadoLegado.statusConteudo, 'Planejado');
    const registrado = banco.salvar('planejamentos', validadoLegado, usuario);
    assert.equal(validarPlanejamento(legado, banco, usuario, registrado.id).aulaId, aula.id);
    assert.throws(() => validarPlanejamento(legado, banco, usuario), /já tem planejamento/);
    assert.throws(
      () => validarPlanejamento({ ...legado, statusConteudo: 'Finalizado' }, banco, usuario, registrado.id),
      /Opção inválida/,
    );
    assert.deepEqual(validarModelo({
      nome: 'Modelo', previsto: 'Leitura', objetivos: 'Compreender', metodologia: 'Leitura orientada',
    }), {
      nome: 'Modelo', previsto: 'Leitura', objetivos: 'Compreender',
      metodologia: 'Leitura orientada', atividades: '',
    });
  } finally {
    banco.fechar();
  }
});
