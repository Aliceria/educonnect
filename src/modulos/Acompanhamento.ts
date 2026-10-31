import { texto, data, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoDoUsuario } from './Alunos.ts';
import { ErroCadastro } from './Professores.ts';

function numeroOpcional(d: Dados, campo: string, minimo: number, maximo: number): number | undefined {
  const valor = d[campo];
  if (valor === undefined || valor === null || valor === '') return undefined;

  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) {
    throw new ErroCadastro(`O campo ${campo} deve estar entre ${minimo} e ${maximo}.`);
  }
  return numero;
}

function textoOpcional(d: Dados, campo: string): string {
  return texto({ ...d, [campo]: d[campo] ?? '' }, campo, false);
}

export function validarAcompanhamento(d: Dados, banco: Banco, usuario: Usuario) {
  const alunoId = texto(d, 'alunoId');
  const aluno = alunoDoUsuario(banco, usuario, alunoId);
  const aulaId = texto(d, 'aulaId', false);

  if (aulaId && banco.buscar('aulas', aulaId, usuario).dados.alunoId !== alunoId) {
    throw new ErroCadastro('A aula pertence a outro aluno.');
  }

  const tipo = escolha(
    { ...d, tipo: d.tipo || 'Evolução' },
    'tipo',
    ['Diagnóstico inicial', 'Evolução'],
  );
  const frequencia = escolha(
    { ...d, frequencia: d.frequencia || 'Não se aplica' },
    'frequencia',
    ['Não se aplica', 'Presente', 'Falta', 'Falta justificada'],
  );

  return {
    tipo,
    alunoId,
    professorId: aluno.dados.professorId,
    aulaId,
    data: data(d, 'data'),
    disciplina: textoOpcional(d, 'disciplina'),
    avaliacao: textoOpcional(d, 'avaliacao'),
    nota: numeroOpcional(d, 'nota', 0, 10),
    frequencia,
    evolucao: texto(d, 'evolucao'),
    pontosFortes: textoOpcional(d, 'pontosFortes'),
    dificuldades: textoOpcional(d, 'dificuldades'),
    meta: textoOpcional(d, 'meta'),
    objetivo: textoOpcional(d, 'objetivo'),
    progressoMeta: numeroOpcional(d, 'progressoMeta', 0, 100),
    retomar: textoOpcional(d, 'retomar'),
  };
}

export function validarNecessidade(d: Dados, banco: Banco, usuario: Usuario) {
  const alunoId = texto(d, 'alunoId');
  const aluno = alunoDoUsuario(banco, usuario, alunoId);
  return {
    alunoId,
    professorId: aluno.dados.professorId,
    adaptacao: texto(d, 'adaptacao'),
    descricao: texto(d, 'descricao', false),
    informacao: texto(d, 'informacao', false),
  };
}
