import { texto } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';
export function validarModelo(d: Dados) {
  return {nome:texto(d,'nome'),previsto:texto(d,'previsto'),objetivos:texto(d,'objetivos'),atividades:texto(d,'atividades',false)};
}
export function validarPlanejamento(d: Dados,banco:Banco,usuario:Usuario,id?:string) {
  const aulaId=texto(d,'aulaId');const aula=banco.buscar('aulas',aulaId,usuario);
  if(banco.db.prepare("SELECT id FROM registros WHERE tipo='planejamentos' AND json_extract(dados,'$.aulaId')=? AND id<>?").get(aulaId,id??'')) throw new ErroCadastro('Essa aula já tem planejamento. Edite o existente.',409);
  const conteudos=texto(d,'conteudos',false);for(const c of conteudos.split(',').filter(Boolean)) banco.buscar('conteudos',c,usuario);
  const materiais=texto(d,'materiais',false);for(const m of materiais.split(',').filter(Boolean)) banco.buscar('materiais',m,usuario);
  return {aulaId,alunoId:aula.dados.alunoId,professorId:aula.dados.professorId,nome:aula.dados.nome,previsto:texto(d,'previsto'),objetivos:texto(d,'objetivos'),atividades:texto(d,'atividades',false),conteudos,materiais,trabalhado:texto(d,'trabalhado',false),tarefa:texto(d,'tarefa',false),retomar:texto(d,'retomar',false)};
}
