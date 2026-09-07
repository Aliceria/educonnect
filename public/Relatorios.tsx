import { useEffect, useState } from 'react';
import { api } from './api';
import type { Aluno } from '../src/integracao';
import type { Relatorio } from '../src/modulos/Relatorios';

const opcoes = {individual:'Individual do aluno',evolucao:'Evolução',frequencia:'Frequência',aulas:'Aulas realizadas',canceladas:'Aulas canceladas',conteudos:'Conteúdos trabalhados',avaliacoes:'Avaliações e notas',financeiro:'Financeiro',pendentes:'Pagamentos pendentes',faturamento:'Faturamento mensal',horas:'Horas trabalhadas',responsavel:'Para o responsável'};
export default function Relatorios() {
  const [tipo,setTipo]=useState('individual'); const [inicio,setInicio]=useState(''); const [fim,setFim]=useState('');const [alunoId,setAlunoId]=useState('');
  const [alunos,setAlunos]=useState<Aluno[]>([]);const [resultado,setResultado]=useState<Relatorio|null>(null);const [consulta,setConsulta]=useState('');
  const [erro,setErro]=useState('');const [ocupado,setOcupado]=useState(false);
  useEffect(()=>{api<{alunos:Aluno[]}>('/referencias').then(r=>setAlunos(r.alunos)).catch(e=>setErro(e.message));},[]);
  async function gerar() {
    setOcupado(true);setErro('');setResultado(null);
    try {const p=new URLSearchParams({tipo,inicio,fim,alunoId}).toString();setResultado(await api(`/relatorios?${p}`));setConsulta(p);}
    catch(e){setErro((e as Error).message);}finally{setOcupado(false);}
  }
  return <div className="cadastro"><h2>Relatórios</h2><div className="campos">
    <label>Relatório<select value={tipo} onChange={e=>setTipo(e.target.value)}>{Object.entries(opcoes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Aluno<select value={alunoId} onChange={e=>setAlunoId(e.target.value)}><option value="">{tipo==='responsavel'?'Selecione um aluno':'Todos'}</option>{alunos.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
    <label>De<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} /></label><label>Até<input type="date" value={fim} onChange={e=>setFim(e.target.value)} /></label>
  </div><button disabled={ocupado || (tipo==='responsavel'&&!alunoId)} onClick={gerar}>Gerar relatório</button>{erro&&<p role="alert" className="erro">{erro}</p>}
  {resultado&&<><h3>{resultado.titulo}</h3><p>{resultado.periodo}</p>{resultado.resumo.map((r,i)=><p key={i}>{r}</p>)}{resultado.avisos.map((r,i)=><p className="observacao" key={i}>{r}</p>)}
    <p><a href={`/api/relatorios/pdf?${consulta}`} download="relatorio.pdf">Baixar PDF deste relatório</a></p>
    {!resultado.linhas.length?<p>Nenhum registro encontrado.</p>:<div className="tabela"><table><thead><tr>{resultado.colunas.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{resultado.linhas.map((l,i)=><tr key={i}>{l.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
  </>}</div>;
}
