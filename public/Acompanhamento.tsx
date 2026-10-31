import Cadastro from './Cadastro';
import type { Registro } from '../src/banco';

function GraficoEvolucao({ registros }: { registros: Registro[] }) {
  const avaliacoes = registros
    .filter((registro) => {
      const nota = registro.dados.nota;
      return nota !== '' && nota !== undefined && nota !== null && Number.isFinite(Number(nota));
    })
    .sort((a, b) => String(a.dados.data ?? '').localeCompare(String(b.dados.data ?? '')))
    .slice(-10);

  return (
    <section className="cadastro">
      <h3>Evolução das notas</h3>
      {!avaliacoes.length ? (
        <p>Cadastre acompanhamentos com notas para visualizar o gráfico.</p>
      ) : (
        <>
          <p>Últimos {avaliacoes.length} registros com nota.</p>
          <div
            className="acompanhamento-grafico"
            role="img"
            aria-label="Gráfico das últimas notas de zero a dez"
          >
            {avaliacoes.map((registro) => {
              const nota = Math.min(10, Math.max(0, Number(registro.dados.nota)));
              return (
                <div className="acompanhamento-grafico-item" key={registro.id}>
                  <strong>{nota.toLocaleString('pt-BR')}</strong>
                  <div
                    className={nota >= 6 ? 'acompanhamento-barra aprovado' : 'acompanhamento-barra'}
                    style={{ height: `${Math.max(4, nota * 14)}px` }}
                    title={`Nota ${nota}`}
                  />
                  <small>{String(registro.dados.data ?? '').slice(0, 10)}</small>
                  <small>{String(registro.dados.disciplina ?? '')}</small>
                </div>
              );
            })}
          </div>
          <p className="observacao">
            O gráfico é apenas visual; os critérios de aprovação seguem as regras da instituição.
          </p>
        </>
      )}
    </section>
  );
}

export default function Acompanhamento() {
  return (
    <>
      <h2>Acompanhamento pedagógico</h2>
      <p>Registre a evolução, as avaliações, a frequência e as metas de cada aluno.</p>

      <Cadastro
        titulo="Evolução, avaliações e frequência"
        tipo="acompanhamentos"
        campos={[
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'aulaId', rotulo: 'Aula relacionada', fonte: 'aulas', opcional: true },
          { nome: 'data', rotulo: 'Data do acompanhamento', tipo: 'data' },
          {
            nome: 'tipo',
            rotulo: 'Tipo de acompanhamento',
            opcoes: ['Diagnóstico inicial', 'Evolução'],
            inicial: 'Evolução',
          },
          { nome: 'disciplina', rotulo: 'Disciplina', opcional: true },
          { nome: 'avaliacao', rotulo: 'Nome da avaliação', opcional: true },
          {
            nome: 'nota',
            rotulo: 'Nota (0 a 10)',
            tipo: 'numero',
            minimo: 0,
            maximo: 10,
            passo: 0.1,
            opcional: true,
          },
          {
            nome: 'frequencia',
            rotulo: 'Frequência',
            opcoes: ['Não se aplica', 'Presente', 'Falta', 'Falta justificada'],
            inicial: 'Não se aplica',
          },
          { nome: 'evolucao', rotulo: 'Evolução e resultados observados', tipo: 'area' },
          { nome: 'pontosFortes', rotulo: 'Pontos fortes do aluno', tipo: 'area', opcional: true },
          {
            nome: 'dificuldades',
            rotulo: 'Conteúdos e habilidades com dificuldade',
            tipo: 'area',
            opcional: true,
          },
          { nome: 'meta', rotulo: 'Meta de aprendizagem', tipo: 'area', opcional: true },
          { nome: 'objetivo', rotulo: 'Objetivo de aprendizagem', tipo: 'area', opcional: true },
          {
            nome: 'progressoMeta',
            rotulo: 'Progresso da meta (%)',
            tipo: 'numero',
            minimo: 0,
            maximo: 100,
            passo: 1,
            opcional: true,
          },
          { nome: 'retomar', rotulo: 'Ações para a próxima aula', tipo: 'area', opcional: true },
        ]}
        rodape={(registros) => <GraficoEvolucao registros={registros} />}
      />

      <Cadastro
        titulo="Necessidades educacionais"
        tipo="necessidades"
        aviso="Registre somente informações relevantes ao acompanhamento pedagógico."
        campos={[
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'adaptacao', rotulo: 'Adaptação pedagógica necessária', tipo: 'area' },
          { nome: 'descricao', rotulo: 'Descrição / diagnóstico informado', tipo: 'area', opcional: true },
          {
            nome: 'informacao',
            rotulo: 'Informação complementar e origem',
            tipo: 'area',
            opcional: true,
          },
        ]}
      />
    </>
  );
}
