import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { resumoDashboard } from '../src/modulos/Dashboard';

type Resumo = ReturnType<typeof resumoDashboard>;
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (data: string) => data.slice(0, 10).split('-').reverse().join('/') + (data.includes('T') ? ` ${data.slice(11, 16)}` : '');

export default function Dashboard() {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [atualizado, setAtualizado] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const consulta = useRef(0);
  const carregar = useCallback(async () => {
    const id = ++consulta.current;
    setCarregando(true);
    try {
      const novo = await api<Resumo>('/dashboard');
      if (id !== consulta.current) return;
      setDados(novo);
      setErro('');
      setAtualizado(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) {
      if (id === consulta.current) {
        setDados(null);
        setErro((e as Error).message);
      }
    } finally {
      if (id === consulta.current) setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
    const atualizar = () => { void carregar(); };
    const aoRetornar = () => { if (!document.hidden) atualizar(); };
    const intervalo = window.setInterval(aoRetornar, 60000);
    window.addEventListener('cadastro-atualizado', atualizar);
    window.addEventListener('focus', aoRetornar);
    document.addEventListener('visibilitychange', aoRetornar);
    return () => {
      consulta.current++;
      clearInterval(intervalo);
      window.removeEventListener('cadastro-atualizado', atualizar);
      window.removeEventListener('focus', aoRetornar);
      document.removeEventListener('visibilitychange', aoRetornar);
    };
  }, [carregar]);
  const evolucao = dados?.evolucao.find(a => a.alunoId === alunoId) ?? dados?.evolucao[0];
  const pontos = evolucao?.pontos ?? [];
  const x = (i: number) => pontos.length === 1 ? 340 : 70 + i * 540 / (pontos.length - 1);
  const y = (percentual: number) => 220 - percentual * 1.8;
  const indicadores: [string, string | number][] = [];
  if (dados) {
    if (dados.permissoes.alunos) indicadores.push(['Alunos ativos', dados.alunos.length]);
    if (dados.permissoes.agendamento) indicadores.push(['Aulas hoje', dados.aulasHoje.length], ['Aulas na semana', dados.aulasSemana.length], ['Realizadas no mês', dados.realizadas]);
    if (dados.frequencia) indicadores.push(['Frequência no mês', dados.frequencia.percentual === null ? 'Sem registros' : `${dados.frequencia.percentual.toLocaleString('pt-BR')}%`]);
  }
  return <div className="dashboard">
    <div className="cabecalho"><div><h2>Dashboard</h2><p>Resumo das aulas e atividades.</p></div><button onClick={() => void carregar()} disabled={carregando}>{carregando ? 'Atualizando...' : 'Atualizar'}</button></div>
    {erro && <p role="alert">{erro} Use Atualizar para tentar novamente.</p>}
    {carregando && <p role="status">Carregando informações...</p>}
    {dados && <>
      <p className="dashboard-nota">Atualizado às {atualizado}. Atualização automática a cada minuto.</p>
      <div className="resumos">{indicadores.map(([nome, valor]) => <section className="cadastro" key={nome}><h3>{nome}</h3><p className="dashboard-total">{valor}</p></section>)}</div>
      {dados.permissoes.agendamento && <p>Semana: {dataCurta(dados.semana.inicio)} a {dataCurta(dados.semana.fim)} (segunda a domingo). Aulas incluem todos os status.</p>}
      {dados.frequencia && <p>Frequência de {dados.frequencia.mes.split('-').reverse().join('/')}: {dados.frequencia.presentes} presenças e {dados.frequencia.faltas} faltas. Faltas justificadas contam; cancelamentos e faltas do professor não entram.</p>}
      {dados.financeiro && <section className="cadastro"><h3>Resumo financeiro</h3><div className="dashboard-financeiro"><p>Recebido no mês<strong>{moeda(dados.financeiro.recebido)}</strong></p><p>Pendentes (a vencer e hoje)<strong>{moeda(dados.financeiro.pendente)}</strong></p><p>Atrasados<strong>{moeda(dados.financeiro.atrasado)}</strong></p></div><p>Recebidos consideram o mês atual até hoje. Pendentes e atrasados incluem todos os vencimentos.</p></section>}
      {dados.permissoes.avaliacoes && <section className="cadastro"><h3>Evolução dos alunos</h3><p>Aproveitamento em cada avaliação: nota dividida pela nota máxima. Avaliações futuras não entram. As notas podem ser de disciplinas diferentes.</p>
        {evolucao ? <>
          <label>Aluno no gráfico<select value={evolucao.alunoId} onChange={e => setAlunoId(e.target.value)}>{dados.evolucao.map(a => <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>)}</select></label>
          <svg className="dashboard-grafico" viewBox="0 0 660 270" role="img" aria-label={`Evolução de ${evolucao.nome}. Valores completos na tabela abaixo.`}>
            {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1="70" x2="610" y1={y(v)} y2={y(v)} stroke="#bcc9c6"/><text x="60" y={y(v) + 4} textAnchor="end">{v}%</text></g>)}
            <polyline fill="none" stroke="#205e58" strokeWidth="3" points={pontos.map((p, i) => `${x(i)},${y(p.percentual)}`).join(' ')}/>
            {pontos.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.percentual)} r="5" fill="#205e58"><title>{dataCurta(p.data)}: {p.percentual}% — {p.nome}</title></circle>)}
            <text x="70" y="248">{dataCurta(pontos[0].data)}</text><text x="610" y="248" textAnchor="end">{dataCurta(pontos[pontos.length - 1].data)}</text>
          </svg>
          <div className="tabela"><table><caption>Avaliações de {evolucao.nome}</caption><thead><tr><th scope="col">Data</th><th scope="col">Avaliação</th><th scope="col">Aproveitamento</th></tr></thead><tbody>{pontos.map(p => <tr key={p.id}><td>{dataCurta(p.data)}</td><td>{p.nome}</td><td>{p.percentual.toLocaleString('pt-BR')}%</td></tr>)}</tbody></table></div>
        </> : <p>Nenhuma avaliação realizada para mostrar.</p>}
      </section>}
      {dados.permissoes.planejamento && dados.permissoes.agendamento && <section className="cadastro"><h3>Tarefas pendentes</h3><p>Pendências de planejamento: aulas agendadas sem plano e aulas realizadas sem registro do conteúdo trabalhado.</p>{dados.tarefas.length ? <ul className="dashboard-lista">{dados.tarefas.map(t => <li key={t.id}><strong>{t.descricao}</strong><span>{t.aluno} — {dataCurta(t.data)}</span></li>)}</ul> : <p>Nenhuma tarefa pendente.</p>}</section>}
      {(dados.permissoes.agendamento || dados.permissoes.avaliacoes) && <section className="cadastro"><h3>Próximos eventos</h3><p>Aulas agendadas e avaliações a partir de hoje, em ordem de data.</p>{dados.eventos.length ? <ul className="dashboard-lista">{dados.eventos.map(e => <li key={e.id}><strong>{e.tipo}: {e.nome}</strong><span>{e.aluno} — {dataCurta(e.data)}</span></li>)}</ul> : <p>Nenhum evento próximo.</p>}</section>}
      {dados.permissoes.agendamento && <section className="cadastro"><h3>Lembretes de aula</h3>{dados.lembretes.length ? dados.lembretes.map(a => <p key={a.id}>{dataCurta(a.data)} — {dados.alunos.find(s => s.id === a.alunoId)?.nome ?? 'Aluno'}</p>) : <p>Nenhum lembrete no intervalo configurado.</p>}<p>Horas realizadas no mês: {dados.horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p></section>}
      {!indicadores.length && !dados.financeiro && !dados.permissoes.avaliacoes && <p>Nenhum indicador liberado para este acesso.</p>}
    </>}
  </div>;
}
