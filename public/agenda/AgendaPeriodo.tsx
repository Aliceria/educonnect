import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Dados, Registro } from '../../src/banco';
import { api } from '../api';
import type { Referencia } from '../Cadastro';
import { hoje, formatarData, limitesPeriodo, navegarData, classeStatus, periodos, diasVisiveis } from './datas';
import type { Periodo } from './datas';

type ChecklistItem = { id: string; texto: string; concluido: boolean };
type ReferenciasAgenda = Record<string, Referencia[]>;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : String(valor ?? '');
}

function listaTexto(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((item): item is string => typeof item === 'string');
  if (typeof valor === 'string') return valor.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function nomeAluno(aula: Registro, referencias: ReferenciasAgenda): string {
  return referencias.alunos?.find((aluno) => aluno.id === aula.dados.alunoId)?.nome ??
    (texto(aula.dados.nome) || 'Aluno indisponível');
}

function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function AgendaPeriodo({
  aulas,
  referencias,
}: {
  aulas: Registro[];
  referencias: ReferenciasAgenda;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('Semana');
  const [dia, setDia] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [filtroAluno, setFiltroAluno] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [selecionada, setSelecionada] = useState<Registro | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [membros, setMembros] = useState<string[]>([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const [novoMembro, setNovoMembro] = useState('');
  const [planejamentoId, setPlanejamentoId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [statusResultado, setStatusResultado] = useState('Realizada');
  const [statusCancelamento, setStatusCancelamento] = useState('Cancelada pelo professor');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const dias = useMemo(() => diasVisiveis(dia, periodo), [dia, periodo]);
  const { inicio, fim } = limitesPeriodo(dia, periodo);
  const aulasFiltradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return aulas.filter((aula) => {
      const dados = aula.dados;
      const campos = [
        nomeAluno(aula, referencias),
        texto(dados.nome),
        texto(dados.disciplina),
        texto(dados.observacoes),
        texto(dados.conteudos),
        ...listaTexto(dados.etiquetas),
        ...listaTexto(dados.membros),
      ];
      return (
        String(dados.data) >= inicio &&
        String(dados.data) <= fim &&
        (!termo || normalizar(campos.join(' ')).includes(termo)) &&
        (!filtroAluno || dados.alunoId === filtroAluno) &&
        (!filtroStatus || dados.status === filtroStatus)
      );
    });
  }, [aulas, busca, filtroAluno, filtroStatus, inicio, fim, referencias]);

  const planejamentos = referencias.planejamentos ?? [];
  const planejamentosDaAula = selecionada
    ? planejamentos.filter((plano) => plano.dados?.aulaId === selecionada.id)
    : [];
  const etiquetasDisponiveis = [
    'Agendada', 'Realizada', 'Falta', 'Falta justificada', 'Falta do professor',
    'Cancelada pelo aluno', 'Cancelada pelo professor', 'Reagendada', 'Reposição realizada',
  ];

  function abrirDetalhes(aula: Registro) {
    const itens = Array.isArray(aula.dados.checklist) ? aula.dados.checklist : [];
    setSelecionada(aula);
    setChecklist(itens.filter((item): item is ChecklistItem =>
      !!item && typeof item === 'object' &&
      typeof (item as ChecklistItem).id === 'string' &&
      typeof (item as ChecklistItem).texto === 'string' &&
      typeof (item as ChecklistItem).concluido === 'boolean',
    ));
    setEtiquetas(listaTexto(aula.dados.etiquetas));
    setMembros(listaTexto(aula.dados.membros));
    setPlanejamentoId(texto(aula.dados.planejamentoId));
    setObservacoes(texto(aula.dados.observacoes));
    setJustificativa(texto(aula.dados.justificativa));
    setStatusResultado('Realizada');
    setStatusCancelamento('Cancelada pelo professor');
    setErro('');
  }

  async function salvarDetalhes(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!selecionada || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      const dados: Dados = {
        ...selecionada.dados,
        checklist,
        etiquetas,
        membros,
        planejamentoId,
        observacoes,
      };
      await api(`/registros/aulas/${selecionada.id}`, 'PUT', {
        dados,
        versao: selecionada.versao,
      });
      setSelecionada(null);
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function alterarStatus(status: string) {
    if (!selecionada || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      const dados: Dados = {
        ...selecionada.dados,
        status,
        justificativa: status === 'Falta justificada' ? justificativa : '',
      };
      await api(`/registros/aulas/${selecionada.id}`, 'PUT', {
        dados,
        versao: selecionada.versao,
      });
      setSelecionada(null);
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function adicionarItem(
    valor: string,
    itens: string[],
    atualizar: (proximo: string[]) => void,
    limpar: (novo: string) => void,
    limite: number,
  ) {
    const item = valor.trim();
    if (!item || itens.includes(item)) return;
    if (itens.length >= limite) {
      setErro(`O limite é de ${limite} itens.`);
      return;
    }
    atualizar([...itens, item]);
    limpar('');
    setErro('');
  }

  function renderAula(aula: Registro) {
    const status = texto(aula.dados.status);
    const etiquetasDaAula = listaTexto(aula.dados.etiquetas);
    return (
      <button
        className={`agenda-aula ${classeStatus(status)}`}
        key={aula.id}
        type="button"
        onClick={() => abrirDetalhes(aula)}
      >
        <strong>{texto(aula.dados.hora)}</strong>
        <span>{nomeAluno(aula, referencias)}</span>
        {!!aula.dados.disciplina && <small>{texto(aula.dados.disciplina)}</small>}
        <span className={`agenda-status ${classeStatus(status)}`}>{status}</span>
        {!!etiquetasDaAula.length && <small>{etiquetasDaAula.join(', ')}</small>}
      </button>
    );
  }

  function renderDia(diaAtual: string) {
    const lista = aulasFiltradas
      .filter((aula) => aula.dados.data === diaAtual)
      .sort((a, b) => texto(a.dados.hora).localeCompare(texto(b.dados.hora)));
    return (
      <section className="agenda-dia-lista" key={diaAtual}>
        <h4>{formatarData(diaAtual)}</h4>
        {lista.length ? lista.map(renderAula) : <p>Nenhuma aula neste dia.</p>}
      </section>
    );
  }

  return (
    <section className="cadastro agenda-periodo" aria-label="Agenda visual">
      <div className="cabecalho">
        <h3>Agenda</h3>
        <span>{aulasFiltradas.length} aula(s)</span>
      </div>
      <div className="agenda-filtros">
        <label>
          Pesquisar
          <input
            type="search"
            value={busca}
            placeholder="Aluno, disciplina, etiqueta ou membro"
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </label>
        <label>
          Aluno
          <select value={filtroAluno} onChange={(evento) => setFiltroAluno(evento.target.value)}>
            <option value="">Todos os alunos</option>
            {(referencias.alunos ?? []).map((aluno) => (
              <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={filtroStatus} onChange={(evento) => setFiltroStatus(evento.target.value)}>
            <option value="">Todos os status</option>
            {etiquetasDisponiveis.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <div className="agenda-controles">
        <button type="button" onClick={() => setDia(navegarData(dia, periodo, -1))}>Anterior</button>
        <label>
          Data
          <input
            type="date"
            value={dia}
            onChange={(evento) => evento.target.value && setDia(evento.target.value)}
          />
        </label>
        <button type="button" onClick={() => setDia(hoje())}>Hoje</button>
        <button type="button" onClick={() => setDia(navegarData(dia, periodo, 1))}>Próximo</button>
        <label>
          Visualização
          <select value={periodo} onChange={(evento) => setPeriodo(evento.target.value as Periodo)}>
            {periodos.map((opcao) => <option key={opcao}>{opcao}</option>)}
          </select>
        </label>
      </div>
      <p role="status">{formatarData(inicio)} a {formatarData(fim)}</p>
      <div className="agenda-legenda" aria-label="Legenda de status">
        {etiquetasDisponiveis.map((status) => (
          <span key={status} className={`agenda-status ${classeStatus(status)}`}>{status}</span>
        ))}
      </div>
      {periodo === 'Dia' && renderDia(dia)}
      {periodo === 'Semana' && (
        <div className="agenda-semana">
          {dias.map(renderDia)}
        </div>
      )}
      {periodo === 'Mês' && (
        <div className="agenda-mes">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((nome) => (
            <strong className="agenda-cabecalho-dia" key={nome}>{nome}</strong>
          ))}
          {dias.map((diaAtual) => (
            <article
              className={`agenda-celula${diaAtual.slice(0, 7) === dia.slice(0, 7) ? '' : ' fora-mes'}${diaAtual === hoje() ? ' hoje' : ''}`}
              key={diaAtual}
            >
              <button type="button" onClick={() => { setDia(diaAtual); setPeriodo('Dia'); }}>
                {Number(diaAtual.slice(8))}
              </button>
              {aulasFiltradas
                .filter((aula) => aula.dados.data === diaAtual)
                .slice(0, 3)
                .map(renderAula)}
              {aulasFiltradas.filter((aula) => aula.dados.data === diaAtual).length > 3 && (
                <small>+{aulasFiltradas.filter((aula) => aula.dados.data === diaAtual).length - 3} aula(s)</small>
              )}
            </article>
          ))}
        </div>
      )}
      {!aulasFiltradas.length && <p>Nenhuma aula corresponde aos filtros neste período.</p>}

      {selecionada && (
        <section className="agenda-detalhes" aria-label="Detalhes da aula">
          <header className="cabecalho">
            <div>
              <h3>Detalhes da aula</h3>
              <p>{nomeAluno(selecionada, referencias)} — {formatarData(texto(selecionada.dados.data))} às {texto(selecionada.dados.hora)}</p>
            </div>
            <button type="button" onClick={() => setSelecionada(null)}>Fechar</button>
          </header>
          <p>Status atual: <strong>{texto(selecionada.dados.status)}</strong></p>
          <form onSubmit={salvarDetalhes}>
            <label>
              Planejamento vinculado
              <select value={planejamentoId} onChange={(evento) => setPlanejamentoId(evento.target.value)}>
                <option value="">Sem planejamento vinculado</option>
                {planejamentosDaAula.map((plano) => (
                  <option key={plano.id} value={plano.id}>
                    {plano.dados?.nome ? texto(plano.dados.nome) : `Planejamento ${plano.id}`}
                  </option>
                ))}
              </select>
              {planejamentosDaAula.length === 0 && (
                <small>Cadastre o planejamento para esta aula no módulo Planejamento.</small>
              )}
            </label>
            <fieldset>
              <legend>Etiquetas</legend>
              <div className="agenda-adicionar-item">
                <input value={novaEtiqueta} maxLength={80} onChange={(evento) => setNovaEtiqueta(evento.target.value)} aria-label="Nova etiqueta" />
                <button type="button" onClick={() => adicionarItem(novaEtiqueta, etiquetas, setEtiquetas, setNovaEtiqueta, 30)}>Adicionar</button>
              </div>
              <ul className="agenda-tags">
                {etiquetas.map((etiqueta) => (
                  <li key={etiqueta}>{etiqueta}<button type="button" aria-label={`Remover etiqueta ${etiqueta}`} onClick={() => setEtiquetas(etiquetas.filter((item) => item !== etiqueta))}>Remover</button></li>
                ))}
              </ul>
            </fieldset>
            <fieldset>
              <legend>Membros</legend>
              <div className="agenda-adicionar-item">
                <input value={novoMembro} maxLength={150} onChange={(evento) => setNovoMembro(evento.target.value)} aria-label="Novo membro" />
                <button type="button" onClick={() => adicionarItem(novoMembro, membros, setMembros, setNovoMembro, 50)}>Adicionar</button>
              </div>
              <ul>
                {membros.map((membro) => (
                  <li key={membro}>{membro}<button type="button" onClick={() => setMembros(membros.filter((item) => item !== membro))}>Remover</button></li>
                ))}
              </ul>
            </fieldset>
            <fieldset>
              <legend>Checklist</legend>
              <div className="agenda-adicionar-item">
                <input value={novaTarefa} maxLength={300} onChange={(evento) => setNovaTarefa(evento.target.value)} aria-label="Nova tarefa" />
                <button type="button" onClick={() => {
                  const tarefa = novaTarefa.trim();
                  if (!tarefa || checklist.length >= 100) {
                    if (checklist.length >= 100) setErro('O checklist aceita até 100 itens.');
                    return;
                  }
                  setChecklist([...checklist, { id: crypto.randomUUID(), texto: tarefa, concluido: false }]);
                  setNovaTarefa('');
                  setErro('');
                }}>Adicionar</button>
              </div>
              <ul>
                {checklist.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={() => setChecklist(checklist.map((atual) =>
                          atual.id === item.id ? { ...atual, concluido: !atual.concluido } : atual,
                        ))}
                      />
                      {item.texto}
                    </label>
                    <button type="button" onClick={() => setChecklist(checklist.filter((atual) => atual.id !== item.id))}>Remover</button>
                  </li>
                ))}
              </ul>
            </fieldset>
            <label>
              Observações da aula
              <textarea rows={4} maxLength={2000} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} />
            </label>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button type="submit" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar detalhes'}</button>
          </form>

          {selecionada.dados.status === 'Agendada' && (
            <div className="agenda-status-acoes">
              <fieldset>
                <legend>Cancelar aula</legend>
                <label>
                  Motivo
                  <select value={statusCancelamento} onChange={(evento) => setStatusCancelamento(evento.target.value)}>
                    <option>Cancelada pelo professor</option>
                    <option>Cancelada pelo aluno</option>
                  </select>
                </label>
                <button type="button" disabled={ocupado} onClick={() => void alterarStatus(statusCancelamento)}>Confirmar cancelamento</button>
              </fieldset>
              <fieldset>
                <legend>Registrar resultado</legend>
                <label>
                  Resultado
                  <select value={statusResultado} onChange={(evento) => setStatusResultado(evento.target.value)}>
                    <option>Realizada</option>
                    <option>Falta</option>
                    <option>Falta justificada</option>
                    <option>Falta do professor</option>
                  </select>
                </label>
                {statusResultado === 'Falta justificada' && (
                  <label>
                    Justificativa
                    <textarea required maxLength={2000} value={justificativa} onChange={(evento) => setJustificativa(evento.target.value)} />
                  </label>
                )}
                <button type="button" disabled={ocupado} onClick={() => void alterarStatus(statusResultado)}>Salvar resultado</button>
              </fieldset>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
