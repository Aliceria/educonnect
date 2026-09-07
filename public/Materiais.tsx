import { useState } from 'react';
import Cadastro from './Cadastro';
import { api } from './api';
import type { Registro } from '../src/banco';
import type { Aluno } from '../src/integracao';

export default function Materiais() {
  const [selecionado, setSelecionado] = useState<Registro | null>(null);
  const [alunos,setAlunos] = useState<Aluno[]>([]); const [alunoId,setAlunoId] = useState('');
  const [destinatario,setDestinatario] = useState('Aluno'); const [link,setLink] = useState('');
  const [historico,setHistorico] = useState<Array<{alunoId:string;destinatario:string;data:string}>>([]);
  const [erro,setErro] = useState(''); const [mensagem,setMensagem] = useState(''); const [ocupado,setOcupado] = useState(false);
  const [temAnexo,setTemAnexo] = useState(false);
  async function abrir(r: Registro) {
    setSelecionado(r); setLink(''); setErro(''); setMensagem(''); setHistorico([]); setAlunoId('');
    setTemAnexo(!!(r as Registro & {anexo?:unknown}).anexo);
    try {
      const [ref,links] = await Promise.all([api<{alunos:Aluno[]}>('/referencias'),api<typeof historico>(`/materiais/${r.id}/compartilhamentos`)]);
      setAlunos(ref.alunos); setHistorico(links);
    } catch(e) {setErro((e as Error).message);}
  }
  async function anexar(arquivo?: File) {
    if (!arquivo || !selecionado) return;
    setOcupado(true); setErro(''); setMensagem('');
    try {
      if (arquivo.size > 5*1024*1024) throw new Error('O arquivo deve ter até 5 MB.');
      const base64 = await new Promise<string>((resolve,reject) => {const leitor = new FileReader();leitor.onload=()=>resolve(String(leitor.result).split(',')[1]);leitor.onerror=()=>reject(new Error('Falha ao ler arquivo.'));leitor.readAsDataURL(arquivo);});
      await api(`/materiais/${selecionado.id}/anexo`,'POST',{nome:arquivo.name,base64}); setMensagem('Arquivo salvo.');
      setTemAnexo(true); window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch(e) {setErro((e as Error).message);} finally {setOcupado(false);}
  }
  async function compartilhar() {
    if (!selecionado) return; setOcupado(true);setErro('');
    try {
      const resultado = await api<{caminho:string}>(`/materiais/${selecionado.id}/compartilhar`,'POST',{alunoId,destinatario});
      setLink(new URL(resultado.caminho,location.origin).href);
      setHistorico(await api(`/materiais/${selecionado.id}/compartilhamentos`));
    } catch(e) {setErro((e as Error).message);} finally {setOcupado(false);}
  }
  return <><h2>Materiais didáticos</h2><Cadastro titulo="Biblioteca" tipo="materiais" campos={[
    {nome:'nome',rotulo:'Título'}, {nome:'tipo',rotulo:'Tipo',opcoes:['Lista de exercícios','PDF','Imagem','Avaliação','Vídeo','Link']},
    {nome:'disciplinaId',rotulo:'Disciplina',fonte:'disciplinas'}, {nome:'conteudoId',rotulo:'Conteúdo',fonte:'conteudos',depende:'disciplinaId',opcional:true},
    {nome:'aulaId',rotulo:'Aula associada',fonte:'aulas',opcional:true}, {nome:'link',rotulo:'Link externo',opcional:true},
    {nome:'descricao',rotulo:'Descrição',tipo:'area',opcional:true}, {nome:'status',rotulo:'Situação',opcoes:['Ativo','Inativo']},
  ]} acoes={r => <button onClick={() => abrir(r)}>Arquivo e compartilhamento</button>} />
  {selecionado && <section className="cadastro"><h3>{String(selecionado.dados.nome)}</h3>
    {erro && <p className="erro" role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}
    <label>Arquivo (PDF, PNG ou JPEG; até 5 MB)<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={ocupado} onChange={e => void anexar(e.target.files?.[0])} /></label>
    {temAnexo ? <p><a href={`/api/materiais/${selecionado.id}/anexo`}>Baixar arquivo anexado</a></p> : <p>Nenhum arquivo anexado.</p>}
    {!!selecionado.dados.link && <p><a href={String(selecionado.dados.link)} target="_blank" rel="noreferrer">Abrir link externo</a></p>}
    <h4>Compartilhar</h4><p>Gere um link válido por 7 dias e envie ao destinatário. O sistema registra a criação do link; não envia mensagens.</p>
    <div className="campos"><label>Aluno<select value={alunoId} onChange={e => setAlunoId(e.target.value)}><option value="">Selecione</option>{alunos.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
      <label>Destinatário<select value={destinatario} onChange={e => setDestinatario(e.target.value)}><option>Aluno</option><option>Responsável</option></select></label></div>
    {!alunos.length && <p>Sem alunos disponíveis do módulo 1.</p>}
    <button disabled={ocupado || !alunoId} onClick={compartilhar}>Gerar link</button>
    {link && <label>Link para compartilhar<input readOnly value={link} onFocus={e => e.target.select()} /></label>}
    <h4>Histórico de compartilhamentos</h4>{historico.map((h,i)=><p key={i}>{new Date(h.data).toLocaleString('pt-BR')} — {alunos.find(a=>a.id===h.alunoId)?.nome ?? h.alunoId} — {h.destinatario}</p>)}
    <button onClick={()=>setSelecionado(null)}>Fechar</button>
  </section>}</>;
}
