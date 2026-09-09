import {texto,escolha} from '../banco.ts';
import type {Banco,Dados,Usuario} from '../banco.ts';
import {alunoDoUsuario} from './Alunos.ts';
import {ErroCadastro} from './Professores.ts';
export function validarComunicacao(d:Dados,banco:Banco,usuario:Usuario) {
  const alunoId=texto(d,'alunoId');const aluno=alunoDoUsuario(banco,usuario,alunoId);
  const destinatario=escolha(d,'destinatario',['Aluno','Responsável']);
  if(destinatario==='Responsável'&&!aluno.dados.responsavel)throw new ErroCadastro('Aluno sem responsável.');
  return {alunoId,professorId:aluno.dados.professorId,destinatario,canal:escolha(d,'canal',['E-mail','WhatsApp']),assunto:texto(d,'assunto'),mensagem:texto(d,'mensagem'),status:escolha(d,'status',['Rascunho','Enviada manualmente'])};
}
export function prepararEnvio(banco:Banco,usuario:Usuario,id:string) {
  const r=banco.buscar('comunicacoes',id,usuario);const a=alunoDoUsuario(banco,usuario,String(r.dados.alunoId));
  const responsavel=r.dados.destinatario==='Responsável';
  if(r.dados.canal==='E-mail'){
    const email=String(a.dados[responsavel?'emailResponsavel':'email']);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ErroCadastro('Cadastre o e-mail do destinatário.');
    return {url:`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(String(r.dados.assunto))}&body=${encodeURIComponent(String(r.dados.mensagem))}`};
  }
  let telefone=String(a.dados[responsavel?'contatoResponsavel':'telefone']).replace(/\D/g,'');
  if(telefone.length===10||telefone.length===11)telefone='55'+telefone;
  if(!/^\d{12,15}$/.test(telefone))throw new ErroCadastro('Cadastre o telefone com DDD.');
  return {url:`https://wa.me/${telefone}?text=${encodeURIComponent(String(r.dados.mensagem))}`};
}
