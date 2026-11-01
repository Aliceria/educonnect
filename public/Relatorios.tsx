import { useEffect, useState } from 'react';
import { api } from './api';
import type { Aluno } from '../src/integracao';
import type { Relatorio } from '../src/modulos/Relatorios';
import type { Usuario } from '../src/banco';
import { podeGerarRelatorio, relatoriosPorAluno } from '../src/permissoes';

const opcoes = {
  individual: 'Individual do aluno',
  evolucao: 'Evolução',
  frequencia: 'Frequência',
  aulas: 'Aulas realizadas',
  canceladas: 'Aulas canceladas',
  conteudos: 'Conteúdos trabalhados',
  avaliacoes: 'Avaliações e notas',
  financeiro: 'Financeiro',
  pendentes: 'Pagamentos pendentes',
  faturamento: 'Faturamento mensal',
  horas: 'Horas trabalhadas',
  responsavel: 'Para o responsável',
};
export default function Relatorios() {
  const [tipo, setTipo] = useState('individual');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [resultado, setResultado] = useState<Relatorio | null>(null);
  const [consulta, setConsulta] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [tiposPermitidos, setTiposPermitidos] = useState<string[]>([]);
  useEffect(() => {
    const carregar = () => {
      void Promise.all([api<{ alunos: Aluno[] }>('/referencias'), api<Usuario>('/auth/eu')])
        .then(([r, usuario]) => {
          setAlunos(r.alunos);
          const tipos = Object.keys(opcoes).filter(tipo => podeGerarRelatorio(usuario, tipo));
          setTiposPermitidos(tipos);
          setTipo(atual => tipos.includes(atual) ? atual : tipos[0] ?? '');
        })
        .catch((e) => setErro(e.message));
    };
    carregar();
    window.addEventListener('cadastro-atualizado', carregar);
    return () => window.removeEventListener('cadastro-atualizado', carregar);
  }, []);
  const exigeAluno = relatoriosPorAluno.includes(tipo);
  async function gerar() {
    setOcupado(true);
    setErro('');
    setResultado(null);
    try {
      const p = new URLSearchParams({ tipo, inicio, fim, alunoId }).toString();
      setResultado(await api(`/relatorios?${p}`));
      setConsulta(p);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  async function baixarPdf() {
    setBaixando(true);
    setErro('');
    try {
      const resposta = await fetch(`/api/relatorios/pdf?${consulta}`, {
        credentials: 'same-origin',
        signal: AbortSignal.timeout(60000),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(
          corpo?.erro ??
            (resposta.status === 401
              ? 'Sessão encerrada. Entre novamente para exportar o relatório.'
              : 'Não foi possível gerar o PDF do relatório.'),
        );
      }
      const arquivo = await resposta.blob();
      if (!arquivo.size) throw new Error('O arquivo PDF veio vazio. Gere o relatório novamente.');
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixando(false);
    }
  }
  return (
    <div className="cadastro">
      <h2>Relatórios</h2>
      {!tiposPermitidos.length && <p>Nenhum tipo de relatório liberado para os módulos deste usuário.</p>}
      <div className="campos">
        <label>
          Relatório
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(opcoes).filter(([k]) => tiposPermitidos.includes(k)).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Aluno
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
            <option value="">{exigeAluno ? 'Selecione um aluno' : 'Todos'}</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <p className="observacao">
        {exigeAluno
          ? 'Os relatórios individuais, de evolução e para o responsável precisam de um aluno selecionado.'
          : 'Sem aluno selecionado, o relatório reúne todos os alunos com acesso a este usuário. Use o período para limitar as datas.'}
      </p>
      <button disabled={ocupado || !tiposPermitidos.includes(tipo) || (exigeAluno && !alunoId)} onClick={gerar}>
        Gerar relatório
      </button>
      {erro && (
        <p role="alert" className="erro">
          {erro}
        </p>
      )}
      {resultado && (
        <section className="relatorio" aria-label={resultado.titulo}>
          <header className="relatorio-cabecalho">
            <div>
              <p className="relatorio-sobretitulo">Relatório gerado</p>
              <h3>{resultado.titulo}</h3>
              <p className="observacao">
                {resultado.aluno} · {resultado.periodo}
              </p>
              <p className="observacao">
                Gerado em {new Date(resultado.geradoEm).toLocaleString('pt-BR')}
              </p>
            </div>
            <button disabled={baixando} onClick={baixarPdf}>
              {baixando ? 'Gerando PDF...' : 'Exportar em PDF'}
            </button>
          </header>
          {!!resultado.ficha.length && (
            <dl className="relatorio-ficha">
              {resultado.ficha.map((campo) => (
                <div className="relatorio-ficha-item" key={campo.rotulo}>
                  <dt>{campo.rotulo}</dt>
                  <dd>{campo.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {!!resultado.resumo.length && (
            <>
              <h4>Resumo</h4>
              <ul className="relatorio-resumo">
                {resultado.resumo.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {!!resultado.avisos.length && (
            <ul className="relatorio-avisos">
              {resultado.avisos.map((r, i) => (
                <li className="observacao" key={i}>
                  {r}
                </li>
              ))}
            </ul>
          )}
          <h4>Registros</h4>
          {!resultado.linhas.length ? (
            <p className="relatorio-vazio">Nenhum registro encontrado para os filtros selecionados.</p>
          ) : (
            <div className="tabela">
              <table>
                <thead>
                  <tr>
                    {resultado.colunas.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.linhas.map((l, i) => (
                    <tr key={i}>
                      {l.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
