import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import type { Registro } from '../src/banco';
import type { listarCompartilhamentos } from '../src/modulos/Materiais';

type Material = Registro & { anexo: { nome: string; tamanho: number } | null };
type Compartilhamento = ReturnType<typeof listarCompartilhamentos>[number];
type ReferenciaDisciplina = { id: string; dados: { nome: string; disciplinaId?: string } };
type Referencias = {
  alunos: { id: string; nome: string; status: string }[];
  aulas: { id: string; alunoId: string; data: string }[];
};
const vazio = { nome: '', tipo: 'PDF', disciplinaId: '', conteudoId: '', alunoId: '',
  aulaId: '', link: '', descricao: '', status: 'Ativo' };
const tipos = ['Lista de exercícios', 'PDF', 'Imagem', 'Avaliação', 'Vídeo', 'Link'];
const dataHora = (valor: string) => valor ? new Date(valor).toLocaleString('pt-BR', {
  dateStyle: 'short', timeStyle: 'short',
}) : 'Sem aula associada';

async function lerArquivo(arquivo: File) {
  if (!arquivo.size) throw new Error('O arquivo está vazio.');
  if (arquivo.size > 5 * 1024 * 1024) throw new Error('O arquivo deve ter até 5 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo. Selecione-o novamente.'));
    leitor.readAsDataURL(arquivo);
  });
  return { nome: arquivo.name, base64 };
}

export default function Materiais() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [historico, setHistorico] = useState<Compartilhamento[]>([]);
  const [referencias, setReferencias] = useState<Referencias>({ alunos: [], aulas: [] });
  const [disciplinas, setDisciplinas] = useState<ReferenciaDisciplina[]>([]);
  const [conteudos, setConteudos] = useState<ReferenciaDisciplina[]>([]);
  const [form, setForm] = useState<typeof vazio | null>(null);
  const [editando, setEditando] = useState<Material | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [selecionado, setSelecionado] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [destinatario, setDestinatario] = useState('Aluno');
  const [link, setLink] = useState('');
  const [expiraEm, setExpiraEm] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroDisciplina, setFiltroDisciplina] = useState('');
  const [filtroAluno, setFiltroAluno] = useState('');
  const [filtroAula, setFiltroAula] = useState('');
  const [filtroCompartilhamento, setFiltroCompartilhamento] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const operando = useRef(false);
  const consulta = useRef(0);
  const materialSelecionado = materiais.find(m => m.id === selecionado);

  async function carregar() {
    const atual = ++consulta.current;
    setCarregando(true);
    try {
      const [lista, refs, cadastros, compartilhamentos] = await Promise.all([
        api<Material[]>('/registros/materiais'), api<Referencias>('/referencias'),
        api<{ disciplinas: ReferenciaDisciplina[]; conteudos: ReferenciaDisciplina[] }>('/materiais/referencias'),
        api<Compartilhamento[]>('/materiais/compartilhamentos'),
      ]);
      if (atual !== consulta.current) return;
      setMateriais(lista); setReferencias(refs); setDisciplinas(cadastros.disciplinas);
      setConteudos(cadastros.conteudos); setHistorico(compartilhamentos);
    } catch (e) {
      if (atual === consulta.current) setErro((e as Error).message);
    } finally {
      if (atual === consulta.current) setCarregando(false);
    }
  }
  useEffect(() => {
    const atualizar = () => { void carregar(); };
    atualizar();
    window.addEventListener('cadastro-atualizado', atualizar);
    window.addEventListener('focus', atualizar);
    return () => {
      consulta.current++;
      window.removeEventListener('cadastro-atualizado', atualizar);
      window.removeEventListener('focus', atualizar);
    };
  }, []);

  function abrir(registro?: Material) {
    setErro(''); setMensagem(''); setSelecionado(''); setArquivo(null);
    setEditando(registro ?? null);
    setForm(registro ? Object.fromEntries(Object.keys(vazio).map(chave =>
      [chave, String(registro.dados[chave] ?? vazio[chave as keyof typeof vazio])])) as typeof vazio : { ...vazio });
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form || operando.current) return;
    operando.current = true; setOcupado(true); setErro(''); setMensagem('');
    try {
      const anexo = arquivo ? await lerArquivo(arquivo) : undefined;
      await api('/registros/materiais' + (editando ? '/' + editando.id : ''),
        editando ? 'PUT' : 'POST', { dados: form, versao: editando?.versao, anexo });
      setForm(null); setArquivo(null);
      setMensagem(anexo ? 'Material e arquivo salvos.' : 'Material salvo.');
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) { setErro((e as Error).message); }
    finally { operando.current = false; setOcupado(false); }
  }
  function abrirCompartilhamento(material: Material) {
    setSelecionado(material.id); setAlunoId(alunoVinculado(material));
    setDestinatario('Aluno'); setLink(''); setExpiraEm(''); setErro(''); setMensagem('');
  }
  async function compartilhar() {
    if (!materialSelecionado || !alunoId || operando.current) return;
    operando.current = true; setOcupado(true); setErro(''); setMensagem(''); setLink('');
    try {
      const r = await api<{ caminho: string; expiraEm: string }>(
        '/materiais/' + materialSelecionado.id + '/compartilhar', 'POST', { alunoId, destinatario });
      setLink(new URL(r.caminho, location.origin).href); setExpiraEm(r.expiraEm);
      setMensagem('Material disponível na área do destinatário.');
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) { setErro((e as Error).message); }
    finally { operando.current = false; setOcupado(false); }
  }
  function alunoVinculado(material: Material) {
    return String(material.dados.alunoId || referencias.aulas.find(a => a.id === material.dados.aulaId)?.alunoId || '');
  }
  const nomeAluno = (id: string) => referencias.alunos.find(a => a.id === id)?.nome || 'Sem aluno associado';
  const nomeDisciplina = (id: unknown) => String(disciplinas.find(d => d.id === id)?.dados.nome || 'Disciplina indisponível');
  const aulaMaterial = (id: unknown) => referencias.aulas.find(a => a.id === id);
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtrados = materiais.filter(material => {
    const compartilhados = historico.filter(h => h.materialId === material.id);
    const aluno = alunoVinculado(material);
    const texto = [material.dados.nome, material.dados.descricao, material.dados.tipo,
      nomeDisciplina(material.dados.disciplinaId), aluno ? nomeAluno(aluno) : '',
      aulaMaterial(material.dados.aulaId)?.data || ''].join(' ');
    return (!filtroDisciplina || material.dados.disciplinaId === filtroDisciplina) &&
      (!filtroAluno || aluno === filtroAluno || compartilhados.some(h => h.alunoId === filtroAluno)) &&
      (!filtroAula || material.dados.aulaId === filtroAula) &&
      (!filtroCompartilhamento || (filtroCompartilhamento === 'sim' ? compartilhados.length > 0 : !compartilhados.length)) &&
      normalizar(texto).includes(normalizar(busca));
  });
  const idsVisiveis = new Set(filtrados.map(material => material.id));
  const historicoFiltrado = historico.filter(h => idsVisiveis.has(h.materialId) &&
    (!selecionado || h.materialId === selecionado) && (!filtroAluno || h.alunoId === filtroAluno));

  return (
    <div className="materiais">
      <section className="cadastro">
        <div className="cabecalho">
          <div><h2>Materiais didáticos</h2><p>Biblioteca de arquivos, links e conteúdos das aulas.</p></div>
          <div className="acoes">
            <button disabled={ocupado || !!form || carregando} onClick={() => abrir()}>Novo material</button>
            <button disabled={ocupado || carregando} onClick={() => { setErro(''); void carregar(); }}>Atualizar</button>
          </div>
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {mensagem && <p className="sucesso" role="status">{mensagem}</p>}
        {form && <form onSubmit={salvar}>
          <fieldset disabled={ocupado}>
            <legend>{editando ? 'Editar material' : 'Novo material'}</legend>
            <div className="campos">
              <label>Título<input required maxLength={2000} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
              <label>Tipo<select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{tipos.map(tipo => <option key={tipo}>{tipo}</option>)}</select></label>
              <label>Disciplina<select required value={form.disciplinaId} onChange={e => setForm({ ...form, disciplinaId: e.target.value, conteudoId: '' })}>
                <option value="">Selecione</option>{disciplinas.map(d => <option key={d.id} value={d.id}>{String(d.dados.nome)}</option>)}
              </select>{!disciplinas.length && <small>Cadastre uma disciplina para organizar os materiais.</small>}</label>
              <label>Conteúdo<select value={form.conteudoId} onChange={e => setForm({ ...form, conteudoId: e.target.value })}>
                <option value="">Sem conteúdo associado</option>{conteudos.filter(c => c.dados.disciplinaId === form.disciplinaId).map(c => <option key={c.id} value={c.id}>{String(c.dados.nome)}</option>)}
              </select></label>
              <label>Aluno associado<select value={form.alunoId} onChange={e => setForm({ ...form, alunoId: e.target.value, aulaId: '' })}>
                <option value="">Sem aluno associado</option>{referencias.alunos.filter(a => a.status === 'Ativo' || a.id === form.alunoId).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select></label>
              <label>Aula associada<select value={form.aulaId} onChange={e => {
                const aula = referencias.aulas.find(a => a.id === e.target.value);
                setForm({ ...form, aulaId: e.target.value, alunoId: aula?.alunoId || form.alunoId });
              }}>
                <option value="">Sem aula associada</option>{referencias.aulas.filter(a => !form.alunoId || a.alunoId === form.alunoId).map(a => <option key={a.id} value={a.id}>{dataHora(a.data)} — {nomeAluno(a.alunoId)}</option>)}
              </select></label>
              <label>Descrição<textarea maxLength={2000} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
              <label>Arquivo (PDF, PNG ou JPEG; até 5 MB)<input key={editando?.id || 'novo'} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
                {editando?.anexo && <small>Arquivo atual: {editando.anexo.nome}. Selecionar outro arquivo substitui o atual.</small>}
              </label>
              <label>Link externo<input type="url" maxLength={2000} value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} /></label>
              <label>Situação<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Ativo</option><option>Inativo</option></select></label>
            </div>
            <div className="acoes"><button type="submit">{ocupado ? 'Salvando...' : 'Salvar material'}</button>
              <button type="button" onClick={() => { setForm(null); setArquivo(null); }}>Cancelar</button></div>
          </fieldset>
        </form>}
        <div className="campos materiais-filtros">
          <label>Buscar material<input type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label>
          <label>Filtrar por disciplina<select value={filtroDisciplina} onChange={e => setFiltroDisciplina(e.target.value)}>
            <option value="">Todas</option>{disciplinas.map(d => <option key={d.id} value={d.id}>{String(d.dados.nome)}</option>)}
          </select></label>
          <label>Filtrar por aluno<select value={filtroAluno} onChange={e => setFiltroAluno(e.target.value)}>
            <option value="">Todos</option>{referencias.alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select></label>
          <label>Filtrar por aula<select value={filtroAula} onChange={e => setFiltroAula(e.target.value)}>
            <option value="">Todas</option>{referencias.aulas.map(a => <option key={a.id} value={a.id}>{dataHora(a.data)} — {nomeAluno(a.alunoId)}</option>)}
          </select></label>
          <label>Compartilhamento<select value={filtroCompartilhamento} onChange={e => setFiltroCompartilhamento(e.target.value)}>
            <option value="">Todos os materiais</option><option value="sim">Já compartilhados</option><option value="nao">Ainda não compartilhados</option>
          </select></label>
        </div>
        {carregando && <p role="status">Carregando materiais...</p>}
        {!carregando && !filtrados.length && <p>Nenhum material encontrado.</p>}
        <div className="materiais-lista">
          {filtrados.map(material => {
            const compartilhados = historico.filter(h => h.materialId === material.id);
            const aluno = alunoVinculado(material);
            const aula = aulaMaterial(material.dados.aulaId);
            return <article className="material-cartao" key={material.id}>
              <div className="cabecalho"><h3>{String(material.dados.nome)}</h3><span className="material-situacao">{String(material.dados.status)}</span></div>
              <p>{String(material.dados.descricao || 'Sem descrição.')}</p>
              <dl className="material-detalhes">
                <dt>Tipo</dt><dd>{String(material.dados.tipo)}</dd>
                <dt>Disciplina</dt><dd>{nomeDisciplina(material.dados.disciplinaId)}</dd>
                <dt>Aluno</dt><dd>{aluno ? nomeAluno(aluno) : 'Sem aluno associado'}</dd>
                <dt>Aula</dt><dd>{aula ? dataHora(aula.data) : 'Sem aula associada'}</dd>
                <dt>Arquivo</dt><dd>{material.anexo ? material.anexo.nome + ' (' + (material.anexo.tamanho / 1024).toFixed(1) + ' KB)' : 'Nenhum arquivo anexado'}</dd>
              </dl>
              {material.anexo && <p><a href={'/api/materiais/' + material.id + '/anexo'} target="_blank" rel="noreferrer">Abrir arquivo</a></p>}
              {!!material.dados.link && <p><a href={String(material.dados.link)} target="_blank" rel="noreferrer">Abrir link externo</a></p>}
              <p className="material-compartilhado">{compartilhados.length
                ? 'Já compartilhado — ' + new Set(compartilhados.map(h => h.alunoId)).size + ' aluno(s)'
                : 'Ainda não compartilhado'}</p>
              <div className="acoes">
                <button disabled={ocupado || !!form} onClick={() => abrir(material)}>Editar material</button>
                <button disabled={ocupado || !!form} onClick={() => abrirCompartilhamento(material)}>Compartilhar e histórico</button>
              </div>
            </article>;
          })}
        </div>
      </section>
      {materialSelecionado && <section className="cadastro">
        <div className="cabecalho"><h3>Compartilhar: {String(materialSelecionado.dados.nome)}</h3>
          <button disabled={ocupado} onClick={() => { setSelecionado(''); setLink(''); }}>Fechar compartilhamento</button></div>
        <p>O material aparece na área do destinatário. O acesso fica disponível por sete dias.</p>
        <div className="campos">
          <label>Aluno destinatário<select disabled={ocupado} value={alunoId} onChange={e => { setAlunoId(e.target.value); setLink(''); }}>
            <option value="">Selecione</option>{referencias.alunos.filter(a => a.status === 'Ativo' &&
              (!alunoVinculado(materialSelecionado) || a.id === alunoVinculado(materialSelecionado))).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select></label>
          <label>Destinatário<select disabled={ocupado} value={destinatario} onChange={e => { setDestinatario(e.target.value); setLink(''); }}><option>Aluno</option><option>Responsável</option></select></label>
        </div>
        {!materialSelecionado.anexo && !materialSelecionado.dados.link && <p>Adicione um arquivo ou link ao material antes de compartilhar.</p>}
        <button disabled={ocupado || !alunoId || materialSelecionado.dados.status !== 'Ativo' ||
          (!materialSelecionado.anexo && !materialSelecionado.dados.link)} onClick={() => void compartilhar()}>
          {ocupado ? 'Compartilhando...' : 'Compartilhar material'}
        </button>
        {link && <><label>Link para compartilhar<input readOnly value={link} onFocus={e => e.target.select()} /></label><p>Disponível até {dataHora(expiraEm)}.</p></>}
      </section>}
      <section className="cadastro">
        <div className="cabecalho"><h3>Histórico de compartilhamentos</h3>
          {selecionado && <button onClick={() => { setSelecionado(''); setLink(''); }}>Ver todos os compartilhamentos</button>}</div>
        {!historicoFiltrado.length && <p>Nenhum compartilhamento registrado.</p>}
        {historicoFiltrado.map(h => <article className="material-historico" key={h.id}>
          <h4>{h.nome}</h4><p>{h.aluno} — {h.destinatario} — {h.situacao}</p>
          <p>{h.disciplina}{h.aula ? ' — Aula: ' + dataHora(h.aula) : ''}</p>
          {h.descricao && <p>{h.descricao}</p>}
          <p>Compartilhado em {dataHora(h.data)} por {h.autor}.</p>
        </article>)}
      </section>
    </div>
  );
}
