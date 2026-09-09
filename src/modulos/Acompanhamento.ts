import { texto, data, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoDoUsuario } from './Alunos.ts';
import { ErroCadastro } from './Professores.ts';
export function validarAcompanhamento(d:Dados,banco:Banco,usuario:Usuario) {
  const alunoId=texto(d,'alunoId');const aluno=alunoDoUsuario(banco,usuario,alunoId);
  const aulaId=texto(d,'aulaId',false);
  if(aulaId&&banco.buscar('aulas',aulaId,usuario).dados.alunoId!==alunoId)throw new ErroCadastro('A aula pertence a outro aluno.');
  return {tipo:escolha({...d,tipo:d.tipo??'Evolução'},'tipo',['Diagnóstico inicial','Evolução']),alunoId,professorId:aluno.dados.professorId,aulaId,data:data(d,'data'),evolucao:texto(d,'evolucao'),dificuldades:texto(d,'dificuldades',false),retomar:texto(d,'retomar',false)};
}
export function validarNecessidade(d:Dados,banco:Banco,usuario:Usuario) {
  const alunoId=texto(d,'alunoId');const aluno=alunoDoUsuario(banco,usuario,alunoId);
  return {alunoId,professorId:aluno.dados.professorId,adaptacao:texto(d,'adaptacao'),descricao:texto(d,'descricao',false),informacao:texto(d,'informacao',false)};
}
