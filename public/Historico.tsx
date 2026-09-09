import { useEffect, useState } from 'react';
import { api } from './api';
type Evento = {
  id: number;
  data: string;
  usuario: string;
  modulo: string;
  acao: string;
  registroId: string;
  detalhes: unknown;
};
export default function Historico() {
  const [lista, setLista] = useState<Evento[]>([]);
  const [modulo, setModulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState('');
  async function carregar(p = 1) {
    setErro('');
    try {
      setLista(
        await api(`/historico?${new URLSearchParams({ modulo, inicio, fim, pagina: String(p) })}`),
      );
      setPagina(p);
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  useEffect(() => {
    void carregar();
  }, []);
  return (
    <div className="cadastro">
      <h2>Histórico e auditoria</h2>
      <div className="campos">
        <label>
          Módulo
          <select value={modulo} onChange={(e) => setModulo(e.target.value)}>
            <option value="">Todos</option>
            {[
              'alunos',
              'aulas',
              'planejamentos',
              'modelos',
              'acompanhamentos',
              'necessidades',
              'pacotes',
              'pagamentos',
              'comunicacoes',
              'solicitacoes',
              'professores',
              'disciplinas',
              'conteudos',
              'aprendizados',
              'materiais',
              'avaliacoes',
              'presencas',
              'relatorios',
              'configuracoes',
              'seguranca',
            ].map((m) => (
              <option key={m}>{m}</option>
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
      <button onClick={() => carregar()}>Consultar</button>
      {erro && (
        <p role="alert" className="erro">
          {erro}
        </p>
      )}
      <div className="tabela">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Usuário</th>
              <th>Módulo</th>
              <th>Ação</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.data).toLocaleString('pt-BR')}</td>
                <td>{e.usuario}</td>
                <td>{e.modulo}</td>
                <td>{e.acao}</td>
                <td>
                  <details>
                    <summary>Ver alteração</summary>
                    <pre>{JSON.stringify(e.detalhes, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!lista.length && <p>Nenhum evento encontrado.</p>}
      <div className="acoes">
        <button disabled={pagina === 1} onClick={() => carregar(pagina - 1)}>
          Anterior
        </button>
        <span>Página {pagina}</span>
        <button disabled={lista.length < 100} onClick={() => carregar(pagina + 1)}>
          Próxima
        </button>
      </div>
    </div>
  );
}
