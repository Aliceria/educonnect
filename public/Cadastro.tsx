import { useEffect, useState, useRef } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { api } from './api';
import type { Registro, Dados } from '../src/banco';

export type Campo = {
  nome: string;
  rotulo: string;
  tipo?: 'area' | 'numero' | 'data' | 'hora' | 'multiplo';
  opcoes?: string[];
  fonte?: string;
  depende?: string;
  opcional?: boolean;
  minimo?: number;
  maximo?: number;
  passo?: number;
  inicial?: string | number;
};
export type Referencia = {
  id: string;
  nome?: string;
  data?: string;
  alunoId?: string;
  professorId?: string;
  horarios?: Array<{ dia: number; inicio: string; fim: string }>;
  dados?: Dados;
};
type Props = {
  titulo: string;
  tipo: string;
  campos: Campo[];
  aviso?: string;
  valoresIniciais?: Dados;
  complementoFormulario?: (dados: Dados, referencias: Record<string, Referencia[]>) => ReactNode;
  acoes?: (r: Registro) => ReactNode;
  rodape?: (registros: Registro[], referencias: Record<string, Referencia[]>) => ReactNode;
};

export default function Cadastro({
  titulo,
  tipo,
  campos,
  aviso,
  acoes,
  rodape,
  valoresIniciais,
  complementoFormulario,
}: Props) {
  const [lista, setLista] = useState<Registro[]>([]);
  const [referencias, setReferencias] = useState<Record<string, Referencia[]>>({});
  const [form, setForm] = useState<Dados | null>(null);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState('');
  const salvando = useRef(false);
  const consulta = useRef(0);
  async function carregar() {
    const atual = ++consulta.current;
    setOcupado(true);
    setErro('');
    try {
      const fontes = [...new Set(campos.flatMap((c) => (c.fonte ? [c.fonte] : [])))];
      const relacionadas = fontes.filter(
        (f) => !['alunos', 'aulas', 'professores', 'pacotes', 'materiais'].includes(f),
      );
      const [registros, referencias, listas] = await Promise.all([
        api<Registro[]>(`/registros/${tipo}`),
        api<Record<string, Referencia[]>>('/referencias'),
        Promise.all(relacionadas.map((f) => api<Registro[]>(`/registros/${f}`))),
      ]);
      if (atual !== consulta.current) return;
      relacionadas.forEach((fonte, i) => {
        referencias[fonte] = listas[i];
      });
      setReferencias(referencias);
      setLista(registros);
    } catch (e) {
      if (atual === consulta.current) setErro((e as Error).message);
    } finally {
      if (atual === consulta.current && !salvando.current) setOcupado(false);
    }
  }
  useEffect(() => {
    void carregar();
    const atualizar = () => {
      void carregar();
    };
    window.addEventListener('cadastro-atualizado', atualizar);
    return () => window.removeEventListener('cadastro-atualizado', atualizar);
  }, [tipo]);
  function abrir(registro?: Registro) {
    setEditando(registro ?? null);
    setErro('');
    setMensagem('');
    setForm(
      registro
        ? { ...registro.dados }
        : Object.fromEntries(campos.map((c) => [c.nome, c.inicial ?? c.opcoes?.[0] ?? ''])),
    );
  }
  useEffect(() => {
    if (valoresIniciais) {
      abrir();
      setForm({
        ...Object.fromEntries(campos.map((c) => [c.nome, c.inicial ?? c.opcoes?.[0] ?? ''])),
        ...valoresIniciais,
      });
    }
  }, [valoresIniciais]);
  function mudar(campo: Campo, valor: unknown) {
    setForm((anterior) => {
      const novo = { ...anterior, [campo.nome]: valor };
      for (const c of campos) if (c.depende === campo.nome) novo[c.nome] = '';
      return novo;
    });
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form || ocupado || salvando.current) return;
    salvando.current = true;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      const dados = { ...form };
      for (const campo of campos)
        if (campo.tipo === 'numero') dados[campo.nome] = Number(dados[campo.nome]);
      await api(
        `/registros/${tipo}${editando ? `/${editando.id}` : ''}`,
        editando ? 'PUT' : 'POST',
        { dados, versao: editando?.versao },
      );
      setForm(null);
      await carregar();
      setMensagem('Registro salvo.');
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      salvando.current = false;
      setOcupado(false);
    }
  }
  function rotulo(ref: Referencia) {
    if (ref.nome) return ref.nome;
    if (ref.dados?.nome) return String(ref.dados.nome);
    const aluno = referencias.alunos?.find((a) => a.id === ref.alunoId);
    return `${ref.data ?? ''} — ${aluno?.nome ?? ref.alunoId ?? ref.id}`;
  }
  function mostrar(c: Campo, valor: unknown) {
    if (c.fonte)
      return String(valor ?? '')
        .split(',')
        .filter(Boolean)
        .map((id) => {
          const ref = referencias[c.fonte!]?.find((r) => r.id === id);
          return ref ? rotulo(ref) : 'Indisponível';
        })
        .join(', ');
    return String(valor ?? '');
  }
  const normalizar = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const filtrados = lista.filter((r) =>
    normalizar(campos.map((c) => mostrar(c, r.dados[c.nome])).join(' ')).includes(
      normalizar(busca),
    ),
  );
  return (
    <div className="cadastro">
      <div className="cabecalho">
        <h3>{titulo}</h3>
        <button disabled={ocupado || !!form} onClick={() => abrir()}>
          Novo registro
        </button>
      </div>
      {aviso && <p className="observacao">{aviso}</p>}
      {erro && (
        <p role="alert" className="erro">
          {erro}
        </p>
      )}
      {mensagem && (
        <p role="status" className="sucesso">
          {mensagem}
        </p>
      )}
      {form && (
        <form onSubmit={salvar}>
          <fieldset disabled={ocupado}>
            <legend>{editando ? 'Editar registro' : 'Novo registro'}</legend>
            <div className="campos">
              {campos.map((c) => {
                const valor = String(form[c.nome] ?? '');
                const opcoes = (referencias[c.fonte ?? ''] ?? []).filter(
                  (r) =>
                    (!c.depende || r.dados?.[c.depende] === form[c.depende]) &&
                    r.id !== editando?.id,
                );
                return (
                  <label key={c.nome}>
                    {c.rotulo}
                    {!c.opcional && ' *'}
                    {c.fonte || c.opcoes ? (
                      <select
                        required={!c.opcional}
                        multiple={c.tipo === 'multiplo'}
                        value={c.tipo === 'multiplo' ? valor.split(',').filter(Boolean) : valor}
                        onChange={(e) =>
                          mudar(
                            c,
                            c.tipo === 'multiplo'
                              ? Array.from(e.target.selectedOptions)
                                  .map((o) => o.value)
                                  .join(',')
                              : e.target.value,
                          )
                        }
                      >
                        {c.tipo !== 'multiplo' && <option value="">Selecione</option>}
                        {c.opcoes?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                        {opcoes.map((o) => (
                          <option key={o.id} value={o.id}>
                            {rotulo(o)}
                          </option>
                        ))}
                      </select>
                    ) : c.tipo === 'area' ? (
                      <textarea
                        required={!c.opcional}
                        maxLength={2000}
                        value={valor}
                        onChange={(e) => mudar(c, e.target.value)}
                      />
                    ) : (
                      <input
                        required={!c.opcional}
                        type={
                          c.tipo === 'numero'
                            ? 'number'
                            : c.tipo === 'data'
                              ? 'date'
                              : c.tipo === 'hora'
                                ? 'time'
                                : 'text'
                        }
                        min={c.tipo === 'numero' ? (c.minimo ?? 0) : undefined}
                        max={c.maximo}
                        step={
                          c.tipo === 'hora'
                            ? 60
                            : c.tipo === 'numero'
                              ? (c.passo ?? 0.01)
                              : undefined
                        }
                        maxLength={2000}
                        value={valor}
                        onChange={(e) => mudar(c, e.target.value)}
                      />
                    )}
                    {c.fonte && opcoes.length === 0 && (
                      <small>
                        Nenhuma opção disponível. Cadastre os dados primeiro ou conecte a fonte
                        correta.
                      </small>
                    )}
                  </label>
                );
              })}
            </div>
            {complementoFormulario?.(form, referencias)}
            <div className="acoes">
              <button type="submit">{ocupado ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" onClick={() => setForm(null)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="filtros">
        <label>
          Buscar
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <button disabled={ocupado || !!form} onClick={carregar}>
          Atualizar
        </button>
      </div>
      {ocupado && <p role="status">Carregando...</p>}
      {!ocupado && !filtrados.length && <p>Nenhum registro encontrado.</p>}
      {!!filtrados.length && (
        <div className="tabela">
          <table>
            <caption>{titulo}</caption>
            <thead>
              <tr>
                {campos.slice(0, 5).map((c) => (
                  <th key={c.nome}>{c.rotulo}</th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id}>
                  {campos.slice(0, 5).map((c) => (
                    <td key={c.nome}>{mostrar(c, r.dados[c.nome])}</td>
                  ))}
                  <td>
                    <div className="acoes">
                      <button disabled={ocupado || !!form} onClick={() => abrir(r)}>
                        Editar
                      </button>
                      {acoes?.(r)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rodape?.(lista, referencias)}
    </div>
  );
}
