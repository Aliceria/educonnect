import type {Banco,Usuario} from '../banco.ts';
import type {Fontes} from '../integracao.ts';
import {referencias} from '../integracao.ts';
import {lerConfiguracoes} from './Configuracoes.ts';
export function resumoDashboard(banco:Banco,usuario:Usuario,fontes:Fontes) {
  const ref=referencias(fontes,usuario);const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});const mes=hoje.slice(0,7);
  const planejadas=new Set(banco.listar('planejamentos',usuario).map(p=>p.dados.aulaId));
  const realizadas=ref.aulas.filter(a=>['Presente','Realizada','Reposição realizada'].includes(a.status)&&a.data.startsWith(mes));
  const proximas=ref.aulas.filter(a=>a.data>=hoje&&a.status==='Agendada').sort((a,b)=>a.data.localeCompare(b.data));
  const financeiro=usuario.perfil==='Administrador'||usuario.permissoes.includes('financeiro');
  const minutos=lerConfiguracoes(banco).lembretesMinutos;
  const lembretes=proximas.filter(a=>{const quando=Date.parse(`${a.data}:00-03:00`);return quando>=Date.now()&&quando-Date.now()<=minutos*60000;});
  return {hoje,alunos:ref.alunos.filter(a=>a.status!=='Inativo'),aulasHoje:ref.aulas.filter(a=>a.data.startsWith(hoje)),proximas:proximas.slice(0,10),realizadas:realizadas.length,horas:realizadas.reduce((s,a)=>s+a.duracaoMinutos,0)/60,semPlanejamento:proximas.filter(a=>!planejadas.has(a.id)),provas:banco.listar('avaliacoes',usuario).filter(a=>String(a.dados.data)>=hoje).map(a=>a.dados),lembretes,financeiro:financeiro?{recebido:ref.pagamentos.filter(p=>p.status==='Recebido'&&p.recebidoEm?.startsWith(mes)).reduce((s,p)=>s+p.valor,0),pendente:ref.pagamentos.filter(p=>p.status!=='Recebido').reduce((s,p)=>s+p.valor,0)}:null};
}
