import {texto,numero,data,escolha} from '../banco.ts';
import type {Banco,Dados,Usuario} from '../banco.ts';
import {alunoDoUsuario} from './Alunos.ts';
import {ErroCadastro} from './Professores.ts';
export function validarPacote(d:Dados,banco:Banco,usuario:Usuario) {
  const alunoId=texto(d,'alunoId');const aluno=alunoDoUsuario(banco,usuario,alunoId,true);
  const quantidade=numero(d,'quantidade',1,1000);if(!Number.isInteger(quantidade))throw new ErroCadastro('Quantidade inválida.');
  return {nome:texto(d,'nome'),alunoId,professorId:aluno.dados.professorId,quantidade,valor:numero(d,'valor'),politicaFalta:escolha(d,'politicaFalta',['Não cobrar','Cobrar']),politicaCancelamento:escolha(d,'politicaCancelamento',['Não cobrar','Cobrar'])};
}
export function validarPagamento(d:Dados,banco:Banco,usuario:Usuario) {
  const alunoId=texto(d,'alunoId');const aluno=alunoDoUsuario(banco,usuario,alunoId);
  const pacoteId=texto(d,'pacoteId',false);
  if(pacoteId&&banco.buscar('pacotes',pacoteId,usuario).dados.alunoId!==alunoId)throw new ErroCadastro('Pacote de outro aluno.');
  const status=escolha(d,'status',['Pendente','Recebido','Vencido']);
  const recebidoEm=status==='Recebido'?data(d,'recebidoEm'):'';
  if(recebidoEm>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))throw new ErroCadastro('Recebimento não pode estar no futuro.');
  return {nome:texto(d,'nome'),alunoId,professorId:aluno.dados.professorId,pacoteId,valor:numero(d,'valor'),vencimento:data(d,'vencimento'),recebidoEm,status,forma:texto(d,'forma'),comprovante:texto(d,'comprovante',false)};
}
export function saldoPacote(banco:Banco,usuario:Usuario,id:string) {
  const p=banco.buscar('pacotes',id,usuario);
  const aulas=banco.listar('aulas',usuario).filter(a=>a.dados.pacoteId===id);
  const realizadas=aulas.filter(a=>['Presente','Realizada','Reposição realizada'].includes(String(a.dados.status))).length;
  const cobradas=aulas.filter(a=>(['Falta','Falta justificada'].includes(String(a.dados.status))&&p.dados.politicaFalta==='Cobrar')||(a.dados.status==='Cancelada pelo aluno'&&p.dados.politicaCancelamento==='Cobrar')).length;
  const restantes=Number(p.dados.quantidade)-realizadas-cobradas;
  return {...p,realizadas,cobradas,restantes,agendadas:aulas.filter(a=>a.dados.status==='Agendada').length};
}
