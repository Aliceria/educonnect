import type {Banco,Usuario,Dados} from '../banco.ts';
import {texto,escolha,permitir} from '../banco.ts';
export function solicitarPrivacidade(banco:Banco,usuario:Usuario,d:Dados) {
  return banco.salvar('solicitacoes',{tipo:escolha(d,'tipo',['Correção','Exclusão','Informações sobre tratamento']),descricao:texto(d,'descricao'),status:'Pendente',resposta:''},usuario);
}
export function responderPrivacidade(banco:Banco,usuario:Usuario,id:string,d:Dados) {
 permitir(usuario,'seguranca',true);const anterior=banco.buscar('solicitacoes',id,usuario);
 return banco.salvar('solicitacoes',{...anterior.dados,status:escolha(d,'status',['Em análise','Concluída']),resposta:texto(d,'resposta')},usuario,id,Number(d.versao));
}
export function meusDados(banco:Banco,usuario:Usuario) {
  const portal=['Aluno','Responsável'].includes(usuario.perfil);
  const vinculados=(tipo:string)=>portal?banco.db.prepare("SELECT id,dados FROM registros WHERE tipo=? AND json_extract(dados,'$.alunoId')=?").all(tipo,usuario.alunoId??'').map(r=>({id:String(r.id),dados:JSON.parse(String(r.dados)) as Dados})):[];
  const aluno=portal?banco.db.prepare("SELECT dados FROM registros WHERE tipo='alunos' AND id=?").get(usuario.alunoId??''):undefined;
  const cadastro=aluno?JSON.parse(String(aluno.dados)):{};
  const materiais=portal?banco.db.prepare("SELECT c.id,r.dados FROM compartilhamentos c JOIN registros r ON r.id=c.materialId WHERE c.alunoId=? AND c.destinatario=? AND c.data>=? AND json_extract(r.dados,'$.status')='Ativo'").all(usuario.alunoId??'',usuario.perfil,new Date(Date.now()-7*86400000).toISOString()).map(r=>({id:String(r.id),nome:String(JSON.parse(String(r.dados)).nome)})):[];
  return {usuario,solicitacoes:banco.listar('solicitacoes',usuario),
    aluno:aluno?Object.fromEntries(['nome','idade','telefone','email','responsavel','contatoResponsavel','emailResponsavel','escola','serie'].map(k=>[k,cadastro[k]])):null,
    aulas:vinculados('aulas').map(r=>({id:r.id,data:r.dados.data,hora:r.dados.hora,status:r.dados.status,link:r.dados.link})),
    tarefas:vinculados('planejamentos').filter(r=>r.dados.tarefa).map(r=>({id:r.id,tarefa:r.dados.tarefa})),materiais,
    pagamentos:usuario.perfil==='Responsável'?vinculados('pagamentos').map(r=>({id:r.id,valor:r.dados.valor,vencimento:r.dados.vencimento,status:r.dados.status})):[]};
}
