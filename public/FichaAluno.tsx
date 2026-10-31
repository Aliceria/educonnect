import { useCallback, useEffect, useRef, useState } from 'react';
import type { Registro } from '../src/banco';
import { api } from './api';

type Ficha = { aluno: Registro; registros: Registro[] };
type SecaoHistorico =
  | 'aulas'
  | 'planejamentos'
  | 'acompanhamentos'
  | 'avaliacoes'
  | 'presencas'
  | 'aprendizados'
  | 'pagamentos';
type CampoExibicao = { rotulo: string; valor: unknown; tipo?: 'data' | 'moeda' };

const secoes: Record<SecaoHistorico, string> = {
  aulas: 'Aulas',
  planejamentos: 'Planejamentos',
  acompanhamentos: 'Acompanhamentos',
  avaliacoes: 'Avaliações',
  presencas: 'Presenças',
  aprendizados: 'Aprendizados',
  pagamentos: 'Pagamentos',
};

const camposPerfil: Array<{ secao: string; campos: Array<[string, string]> }> = [
  {
    secao: 'Dados pessoais e responsável',
    campos: [
      ['idade', 'Idade'],
      ['telefone', 'Telefone'],
      ['email', 'E-mail'],
      ['responsavel', 'Responsável legal'],
      ['parentesco', 'Parentesco'],
      ['contatoResponsavel', 'Telefone do responsável'],
      ['emailResponsavel', 'E-mail do responsável'],
      ['autorizacao', 'Registro de autorização'],
    ],
  },
  {
    secao: 'Escola e atendimento',
    campos: [
      ['professorResponsavel', 'Professor responsável'],
      ['escola', 'Escola'],
      ['serie', 'Série / ano'],
      ['disciplina', 'Disciplinas / áreas de estudo'],
      ['objetivo', 'Objetivo de aprendizagem'],
      ['modalidade', 'Modalidade'],
      ['disponibilidade', 'Disponibilidade'],
      ['endereco', 'Endereço'],
    ],
  },
  {
    secao: 'Informações pedagógicas',
    campos: [
      ['dificuldade', 'Dificuldades nos conteúdos'],
      ['observacoes', 'Observações pedagógicas'],
    ],
  },
];

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function texto(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

function formatarData(valor: unknown): string {
  const data = texto(valor);
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!correspondencia) return data;
  return `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}${data.length > 10 ? ` ${data.slice(11, 16)}` : ''}`;
}

function formatarCampo(campo: CampoExibicao): string {
  if (campo.tipo === 'data') return formatarData(campo.valor);
  if (campo.tipo === 'moeda') {
    const valor = Number(campo.valor);
    return Number.isFinite(valor) ? moeda.format(valor) : '';
  }
  return texto(campo.valor);
}

function dataDoRegistro(registro: Registro): string {
  return texto(registro.dados.data || registro.dados.vencimento || registro.dados.recebidoEm);
}

function tituloRegistro(registro: Registro): string {
  const nome = texto(registro.dados.nome);
  if (registro.tipo === 'aulas')
    return texto(registro.dados.disciplina) || nome || 'Aula';
  if (registro.tipo === 'presencas')
    return `Frequência — ${texto(registro.dados.status) || 'registro'}`;
  if (registro.tipo === 'aprendizados')
    return `Aprendizado — ${texto(registro.dados.status) || 'registro'}`;
  if (nome) return nome;
  return secoes[registro.tipo as SecaoHistorico] ?? 'Registro';
}

function camposDoRegistro(registro: Registro): CampoExibicao[] {
  const d = registro.dados;
  const camposPorTipo: Record<string, CampoExibicao[]> = {
    aulas: [
      { rotulo: 'Horário', valor: d.hora },
      { rotulo: 'Duração', valor: d.duracaoMinutos ? `${d.duracaoMinutos} min` : '' },
      { rotulo: 'Situação', valor: d.status },
      { rotulo: 'Disciplina', valor: d.disciplina },
      { rotulo: 'Modalidade', valor: d.modalidade },
      { rotulo: 'Observações', valor: d.observacoes },
      { rotulo: 'Justificativa', valor: d.justificativa },
      { rotulo: 'Conteúdos', valor: d.conteudos },
    ],
    planejamentos: [
      { rotulo: 'Previsto', valor: d.previsto },
      { rotulo: 'Objetivos', valor: d.objetivos },
      { rotulo: 'Atividades', valor: d.atividades },
      { rotulo: 'Trabalhado', valor: d.trabalhado },
      { rotulo: 'Tarefa', valor: d.tarefa },
      { rotulo: 'Retomar na próxima aula', valor: d.retomar },
    ],
    acompanhamentos: [
      { rotulo: 'Tipo', valor: d.tipo },
      { rotulo: 'Evolução', valor: d.evolucao },
      { rotulo: 'Dificuldades', valor: d.dificuldades },
      { rotulo: 'Retomar', valor: d.retomar },
    ],
    avaliacoes: [
      { rotulo: 'Nota', valor: d.nota },
      { rotulo: 'Nota máxima', valor: d.notaMaxima },
      { rotulo: 'Média escolar', valor: d.mediaEscolar },
      { rotulo: 'Dificuldades', valor: d.dificuldades },
      { rotulo: 'Reforçar', valor: d.reforcar },
    ],
    presencas: [
      { rotulo: 'Situação', valor: d.status },
      { rotulo: 'Justificativa', valor: d.justificativa },
    ],
    aprendizados: [
      { rotulo: 'Situação', valor: d.status },
      { rotulo: 'Dificuldades', valor: d.dificuldades },
    ],
    pagamentos: [
      { rotulo: 'Situação', valor: d.status },
      { rotulo: 'Valor', valor: d.valor, tipo: 'moeda' },
      { rotulo: 'Vencimento', valor: d.vencimento, tipo: 'data' },
      { rotulo: 'Recebido em', valor: d.recebidoEm, tipo: 'data' },
      { rotulo: 'Forma de pagamento', valor: d.forma },
      { rotulo: 'Comprovante', valor: d.comprovante },
    ],
  };
  return (camposPorTipo[registro.tipo] ?? []).filter((campo) => texto(campo.valor) !== '');
}

function registrosDoTipo(registros: Registro[], tipo: SecaoHistorico): Registro[] {
  return registros.filter((registro) => registro.tipo === tipo);
}

function resumoFrequencia(registros: Registro[]) {
  const presencas = registrosDoTipo(registros, 'presencas');
  const presentes = presencas.filter((registro) =>
    ['Presente', 'Realizada', 'Reposição realizada'].includes(texto(registro.dados.status)),
  ).length;
  const faltas = presencas.filter((registro) =>
    ['Falta', 'Falta justificada'].includes(texto(registro.dados.status)),
  ).length;
  return {
    presentes,
    faltas,
    percentual: presentes + faltas ? Math.round((presentes / (presentes + faltas)) * 100) : null,
  };
}

function mediaAvaliacoes(registros: Registro[]): number | null {
  const notas = registrosDoTipo(registros, 'avaliacoes')
    .map((registro) => {
      const nota = Number(registro.dados.nota);
      const maxima = Number(registro.dados.notaMaxima);
      return Number.isFinite(nota) && Number.isFinite(maxima) && maxima > 0
        ? (nota / maxima) * 100
        : null;
    })
    .filter((nota): nota is number => nota !== null);
  return notas.length ? Math.round(notas.reduce((soma, nota) => soma + nota, 0) / notas.length) : null;
}

function CampoPerfil({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  const exibicao = texto(valor);
  return (
    <div className="ficha-aluno-campo">
      <dt>{rotulo}</dt>
      <dd>{exibicao || <span className="ficha-aluno-vazio">Não informado</span>}</dd>
    </div>
  );
}

function CartaoResumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="ficha-aluno-resumo-item">
      <span>{rotulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </div>
  );
}

function RegistroHistorico({ registro }: { registro: Registro }) {
  const data = dataDoRegistro(registro);
  const detalhes = camposDoRegistro(registro);
  return (
    <article className="ficha-aluno-evento">
      <div className="ficha-aluno-evento-cabecalho">
        <div>
          <span className="ficha-aluno-etiqueta">{secoes[registro.tipo as SecaoHistorico] ?? 'Histórico'}</span>
          <h4>{tituloRegistro(registro)}</h4>
        </div>
        {data && <time dateTime={data}>{formatarData(data)}</time>}
      </div>
      {detalhes.length > 0 ? (
        <dl className="ficha-aluno-detalhes">
          {detalhes.map((campo) => (
            <div key={campo.rotulo}>
              <dt>{campo.rotulo}</dt>
              <dd>{formatarCampo(campo)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="ficha-aluno-vazio">Sem detalhes adicionais.</p>
      )}
    </article>
  );
}

export default function FichaAluno({
  alunoId,
  onFechar,
}: {
  alunoId: string;
  onFechar: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [filtro, setFiltro] = useState<SecaoHistorico | 'todas'>('todas');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const consulta = useRef(0);

  const carregar = useCallback(async () => {
    const numero = ++consulta.current;
    setCarregando(true);
    setErro('');
    try {
      const resultado = await api<Ficha>(`/alunos/${alunoId}/historico`);
      const referencias = await api<{ professores: Array<{ id: string; nome: string }> }>('/referencias');
      if (numero === consulta.current) {
        const professorResponsavel =
          referencias.professores.find((professor) => professor.id === resultado.aluno.dados.professorId)
            ?.nome ?? '';
        setFicha({
          ...resultado,
          aluno: {
            ...resultado.aluno,
            dados: { ...resultado.aluno.dados, professorResponsavel },
          },
        });
      }
    } catch (e) {
      if (numero === consulta.current) setErro((e as Error).message);
    } finally {
      if (numero === consulta.current) setCarregando(false);
    }
  }, [alunoId]);

  useEffect(() => {
    const atualizar = () => void carregar();
    atualizar();
    window.addEventListener('cadastro-atualizado', atualizar);
    window.addEventListener('focus', atualizar);
    return () => {
      consulta.current++;
      window.removeEventListener('cadastro-atualizado', atualizar);
      window.removeEventListener('focus', atualizar);
    };
  }, [carregar]);

  const registrosOrdenados = [...(ficha?.registros ?? [])].sort((a, b) =>
    dataDoRegistro(b).localeCompare(dataDoRegistro(a)),
  );
  const registrosFiltrados =
    filtro === 'todas'
      ? registrosOrdenados
      : registrosOrdenados.filter((registro) => registro.tipo === filtro);
  const tiposDisponiveis = new Set(registrosOrdenados.map((registro) => registro.tipo));
  const frequencia = resumoFrequencia(ficha?.registros ?? []);
  const media = mediaAvaliacoes(ficha?.registros ?? []);

  return (
    <section className="ficha-aluno" aria-labelledby="ficha-aluno-titulo">
      <header className="ficha-aluno-cabecalho">
        <div>
          <span className="ficha-aluno-sobretitulo">PERFIL COMPLETO DO ALUNO</span>
          <h3 id="ficha-aluno-titulo">{texto(ficha?.aluno.dados.nome) || 'Ficha do aluno'}</h3>
          {ficha && (
            <p>
              Situação: <strong>{texto(ficha.aluno.dados.status) || 'Não informada'}</strong>
            </p>
          )}
        </div>
        <div className="ficha-aluno-acoes">
          <button type="button" disabled={carregando} onClick={() => void carregar()}>
            {carregando ? 'Atualizando...' : 'Atualizar ficha'}
          </button>
          <button type="button" onClick={onFechar}>Fechar ficha</button>
        </div>
      </header>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {carregando && !ficha && <p role="status">Carregando ficha do aluno...</p>}

      {ficha && (
        <>
          <div className="ficha-aluno-resumo" aria-label="Resumo acadêmico">
            <CartaoResumo
              rotulo="Aulas"
              valor={String(registrosDoTipo(ficha.registros, 'aulas').length)}
              detalhe="no histórico disponível"
            />
            <CartaoResumo
              rotulo="Frequência"
              valor={frequencia.percentual === null ? '—' : `${frequencia.percentual}%`}
              detalhe={
                frequencia.percentual === null
                  ? 'sem registros disponíveis'
                  : `${frequencia.presentes} presenças · ${frequencia.faltas} faltas`
              }
            />
            <CartaoResumo
              rotulo="Avaliações"
              valor={media === null ? '—' : `${media}%`}
              detalhe="média percentual"
            />
            <CartaoResumo
              rotulo="Acompanhamentos"
              valor={String(registrosDoTipo(ficha.registros, 'acompanhamentos').length)}
              detalhe="registros pedagógicos"
            />
          </div>

          <div className="ficha-aluno-secoes">
            {camposPerfil.map((grupo) => (
              <section className="ficha-aluno-bloco" key={grupo.secao} aria-label={grupo.secao}>
                <h4>{grupo.secao}</h4>
                <dl className="ficha-aluno-campos">
                  {grupo.campos.map(([campo, rotulo]) => (
                    <CampoPerfil key={campo} rotulo={rotulo} valor={ficha.aluno.dados[campo]} />
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <section className="ficha-aluno-historico" aria-labelledby="ficha-aluno-historico-titulo">
            <div className="ficha-aluno-historico-cabecalho">
              <div>
                <h4 id="ficha-aluno-historico-titulo">Histórico do aluno</h4>
                <p>Registros relacionados disponíveis conforme as permissões da sua conta.</p>
              </div>
              <label>
                Filtrar por tipo
                <select
                  value={filtro}
                  onChange={(evento) => setFiltro(evento.target.value as SecaoHistorico | 'todas')}
                >
                  <option value="todas">Todos os registros</option>
                  {Object.entries(secoes).filter(([tipo]) => tiposDisponiveis.has(tipo)).map(([tipo, nome]) => (
                    <option key={tipo} value={tipo}>{nome}</option>
                  ))}
                </select>
              </label>
            </div>
            {carregando && <p role="status">Atualizando histórico...</p>}
            {!registrosFiltrados.length ? (
              <p className="ficha-aluno-vazio">
                {filtro === 'todas'
                  ? 'Nenhum registro de acompanhamento disponível.'
                  : `Nenhum registro de ${secoes[filtro]} disponível.`}
              </p>
            ) : (
              <div className="ficha-aluno-lista">
                {registrosFiltrados.map((registro) => (
                  <RegistroHistorico key={registro.id} registro={registro} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
