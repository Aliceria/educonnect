import { ErroCadastro } from './modulos/Professores.ts';
import type { Usuario } from './banco.ts';
import type { Banco } from './banco.ts';

// Contrato para os módulos 1–8. Não cria nem altera seus cadastros.
export type Aluno = { id: string; nome: string; professorId: string; responsavel?: string; status?: string };
export type Aula = {
  id: string;
  alunoId: string;
  professorId: string;
  data: string;
  duracaoMinutos: number;
  status: string;
  conteudos: string;
  originalId?: string;
};
export type Pagamento = {
  id: string;
  alunoId: string;
  professorId: string;
  vencimento: string;
  recebidoEm?: string;
  valor: number;
  status: 'Pendente' | 'Recebido' | 'Vencido';
};
export type Fontes = { alunos: () => Aluno[]; aulas: () => Aula[]; pagamentos: () => Pagamento[] };
export const fontesVazias: Fontes = { alunos: () => [], aulas: () => [], pagamentos: () => [] };
export function fontesDoBanco(banco: Banco): Fontes {
  function registros(tipo:string) {
    return banco.db.prepare('SELECT id,dados FROM registros WHERE tipo=?').all(tipo).map(r=>({id:String(r.id),...JSON.parse(String(r.dados))}));
  }
  return {
    alunos:()=>registros('alunos').map(a=>({id:a.id,nome:a.nome,professorId:a.professorId,responsavel:a.responsavel,status:a.status})),
    aulas:()=>registros('aulas').map(a=>{
      const plano=registros('planejamentos').find(p=>p.aulaId===a.id);
      return {id:a.id,alunoId:a.alunoId,professorId:a.professorId,data:`${a.data}T${a.hora}`,duracaoMinutos:a.duracaoMinutos,status:a.status,conteudos:plano?.trabalhado||a.conteudos||'',originalId:a.originalId};
    }),
    pagamentos:()=>registros('pagamentos').map(p=>({id:p.id,alunoId:p.alunoId,professorId:p.professorId,vencimento:p.vencimento,recebidoEm:p.recebidoEm||undefined,valor:p.valor,status:p.status!=='Recebido'&&p.vencimento<new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})?'Vencido':p.status})),
  };
}
export function referencias(fontes: Fontes, usuario: Usuario) {
  const permitido = (item: { professorId: string }) =>
    usuario.perfil === 'Administrador' || item.professorId === usuario.professorId;
  return {
    alunos: fontes.alunos().filter(permitido),
    aulas: fontes.aulas().filter(permitido),
    pagamentos: fontes.pagamentos().filter(permitido),
  };
}
export function alunoValido(fontes: Fontes, usuario: Usuario, id: string) {
  const aluno = referencias(fontes, usuario).alunos.find((item) => item.id === id);
  if (!aluno) throw new ErroCadastro('Aluno indisponível. O cadastro deve vir do módulo 1.');
  return aluno;
}
