import { useState } from 'react';
import type { Registro } from '../../src/banco';
import type { Referencia } from '../Cadastro';
import { hoje, formatarData, limitesPeriodo, navegarData, classeStatus, periodos } from './datas';
import type { Periodo } from './datas';

export default function AgendaPeriodo({ aulas, referencias }: {
  aulas: Registro[]; referencias: Record<string, Referencia[]>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('Semana');
  const [dia, setDia] = useState(hoje);
  const { inicio, fim } = limitesPeriodo(dia, periodo);
  const lista = aulas.filter(a => String(a.dados.data) >= inicio && String(a.dados.data) <= fim)
    .sort((a, b) => `${a.dados.data}T${a.dados.hora}`.localeCompare(`${b.dados.data}T${b.dados.hora}`));
  return <section className="cadastro agenda-periodo">
    <h3>Agenda por período</h3>
    <div className="filtros">
      <label>Visualização<select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}>
        {periodos.map(p => <option key={p}>{p}</option>)}
      </select></label>
      <label>Data de referência<input type="date" required value={dia} onChange={e => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDia(e.target.value);
      }} /></label>
      <button onClick={() => setDia(navegarData(dia, periodo, -1))}>Anterior</button>
      <button onClick={() => setDia(hoje())}>Hoje</button>
      <button onClick={() => setDia(navegarData(dia, periodo, 1))}>Próximo</button>
    </div>
    <p role="status">{formatarData(inicio)} a {formatarData(fim)} — {lista.length} aula(s)</p>
    <p>A semana começa na segunda-feira.</p>
    <div className="agenda-legenda" aria-label="Legenda de situações">
      {['Agendada', 'Realizada', 'Falta', 'Falta justificada', 'Falta do professor', 'Cancelada', 'Reagendada', 'Reposição'].map(s =>
        <span key={s} className={`agenda-status ${classeStatus(s)}`}>{s}</span>)}
    </div>
    <div className="agenda-lista">
      {lista.map(a => {
        const d = a.dados;
        const status = d.status === 'Agendada' && d.originalId ? 'Reposição' : String(d.status);
        return <article className={`agenda-aula ${classeStatus(status)}`} key={a.id}>
          <h4>{referencias.alunos?.find(s => s.id === d.alunoId)?.nome ?? 'Aluno indisponível'}</h4>
          <p><time dateTime={`${d.data}T${d.hora}`}>{formatarData(String(d.data))} às {String(d.hora)}</time> — {String(d.duracaoMinutos)} min</p>
          <span className={`agenda-status ${classeStatus(status)}`}>{status}</span>
          <dl><dt>Disciplina</dt><dd>{String(d.disciplina || 'Não informada')}</dd>
            <dt>Modalidade</dt><dd>{String(d.modalidade || 'Não informada')}</dd>
            <dt>Observações</dt><dd>{String(d.observacoes || 'Sem observações')}</dd>
            {Boolean(d.conteudos) && <><dt>Conteúdo</dt><dd>{String(d.conteudos)}</dd></>}
          </dl>
          {Boolean(d.link) && <a href={String(d.link)} target="_blank" rel="noreferrer">Abrir videochamada</a>}
        </article>;
      })}
    </div>
    {!lista.length && <p>Nenhuma aula neste período.</p>}
  </section>;
}
