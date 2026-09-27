import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from './api';
import type { ListaNotificacoes, TipoNotificacao } from '../src/modulos/Notificacoes';

const tipos: Record<TipoNotificacao, { icone: string; nome: string }> = {
  aula: { icone: '◷', nome: 'Aula' },
  pagamento: { icone: '$', nome: 'Pagamento' },
  avaliacao: { icone: '✓', nome: 'Avaliação' },
  material: { icone: '▤', nome: 'Material' },
  planejamento: { icone: '▦', nome: 'Planejamento' },
};
const formatarData = (data: string) => new Date(data).toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});

export default function Notificacoes() {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<ListaNotificacoes | null>(null);
  const [filtro, setFiltro] = useState('Todas');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const consulta = useRef(0);
  const alterando = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();
  const carregar = useCallback(async () => {
    if (alterando.current) return;
    const numero = ++consulta.current;
    setCarregando(true);
    try {
      const lista = await api<ListaNotificacoes>('/notificacoes');
      if (numero === consulta.current) { setDados(lista); setErro(''); }
    } catch (e) {
      if (numero === consulta.current) setErro((e as Error).message);
    } finally {
      if (numero === consulta.current) setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
    const atualizar = () => { if (!document.hidden) void carregar(); };
    const intervalo = window.setInterval(atualizar, 60000);
    window.addEventListener('cadastro-atualizado', atualizar);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      consulta.current++;
      clearInterval(intervalo);
      window.removeEventListener('cadastro-atualizado', atualizar);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [carregar]);
  async function marcar(notificacaoId?: string) {
    if (alterando.current) return;
    alterando.current = true;
    const numero = ++consulta.current;
    setOcupado(true); setCarregando(false); setErro('');
    try {
      const lista = await api<ListaNotificacoes>(notificacaoId ? `/notificacoes/${notificacaoId}/lida` : '/notificacoes/lidas', 'PUT', {});
      if (numero === consulta.current) setDados(lista);
    } catch (e) {
      if (numero === consulta.current) setErro((e as Error).message);
    } finally {
      alterando.current = false;
      if (numero === consulta.current) setOcupado(false);
    }
  }
  function fechar() { setAberto(false); botao.current?.focus(); }
  const lista = (dados?.notificacoes ?? []).filter(n => filtro === 'Todas' || (filtro === 'Lidas' ? n.lida : !n.lida));
  return <div className="notificacoes" onKeyDown={e => { if (e.key === 'Escape' && aberto) { e.stopPropagation(); fechar(); } }}>
    <button ref={botao} className="notificacoes-botao" aria-expanded={aberto} aria-controls={id}
      onClick={() => { setAberto(!aberto); if (!aberto) void carregar(); }}>
      Notificações <span className="notificacoes-contador" aria-label={dados ? `${dados.naoLidas} ${dados.naoLidas === 1 ? 'não lida' : 'não lidas'}` : 'Carregando notificações'}>{dados?.naoLidas ?? '…'}</span>
      {erro && <span aria-label="Falha na atualização"> !</span>}
    </button>
    {aberto && <section id={id} className="notificacoes-painel" aria-label="Notificações e lembretes">
      <div className="notificacoes-cabecalho"><h2>Notificações</h2><button onClick={fechar}>Fechar</button></div>
      <p role="status">{dados ? `${dados.naoLidas} ${dados.naoLidas === 1 ? 'notificação não lida' : 'notificações não lidas'}` : 'Carregando notificações...'}</p>
      <div className="notificacoes-acoes">
        <label>Exibir<select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option>Todas</option><option>Não lidas</option><option>Lidas</option>
        </select></label>
        <button disabled={ocupado || carregando} onClick={() => void carregar()}>Atualizar</button>
        <button disabled={ocupado || !dados?.naoLidas} onClick={() => void marcar()}>Marcar todas como lidas</button>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {carregando && dados && <p role="status">Atualizando...</p>}
      {dados && !lista.length && <p className="notificacoes-vazio">{filtro === 'Todas' ? 'Nenhuma notificação no momento.' : filtro === 'Lidas' ? 'Nenhuma notificação lida.' : 'Nenhuma notificação não lida.'}</p>}
      <ul className="notificacoes-lista">
        {lista.map(n => <li key={n.id} className={n.lida ? 'notificacao lida' : 'notificacao nova'}>
          <span className="notificacao-icone" aria-hidden="true">{tipos[n.tipo].icone}</span>
          <div className="notificacao-conteudo">
            <div className="notificacao-etiquetas"><span>{tipos[n.tipo].nome}</span>
              <span className={`notificacao-prioridade ${n.prioridade === 'Alta' ? 'alta' : n.prioridade === 'Média' ? 'media' : 'baixa'}`}>Prioridade {n.prioridade.toLowerCase()}</span>
              {!n.lida && <strong>Nova</strong>}
            </div>
            <h3>{n.titulo}</h3><p>{n.mensagem}</p>
            <time dateTime={n.data}>{formatarData(n.data)}</time>
            {!n.lida && <button disabled={ocupado} onClick={() => void marcar(n.id)} aria-label={`Marcar como lida: ${n.titulo}`}>Marcar como lida</button>}
          </div>
        </li>)}
      </ul>
    </section>}
  </div>;
}
