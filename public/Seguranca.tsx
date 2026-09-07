import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
import type { Usuario } from '../src/banco';
import type { Professor } from '../src/modulos/Professores';

export function Entrada({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [instalado,setInstalado]=useState<boolean|null>(null);const [recuperar,setRecuperar]=useState(false);
  const [nome,setNome]=useState('');const [email,setEmail]=useState('');const [senha,setSenha]=useState('');const [codigo,setCodigo]=useState('');
  const [codigoNovo,setCodigoNovo]=useState('');const [erro,setErro]=useState('');const [ocupado,setOcupado]=useState(false);
  async function carregar(){setErro('');try{const estado=await api<{instalado:boolean}>('/auth/estado');setInstalado(estado.instalado);if(estado.instalado){try{onEntrar(await api<Usuario>('/auth/eu','GET',undefined,true));}catch{/* Sem sessão: exibir entrada. */}}}catch(e){setErro((e as Error).message);}}
  useEffect(()=>{void carregar();},[]);
  async function enviar(e:FormEvent){
    e.preventDefault();setOcupado(true);setErro('');
    try{
      if(!instalado){const r=await api<{codigoRecuperacao:string}>('/auth/inicial','POST',{nome,email,senha});setCodigoNovo(r.codigoRecuperacao);setInstalado(true);setSenha('');}
      else if(recuperar){const r=await api<{codigoRecuperacao:string}>('/auth/recuperar','POST',{email,senha,codigo});setCodigoNovo(r.codigoRecuperacao);setRecuperar(false);setSenha('');setCodigo('');}
      else onEntrar(await api<Usuario>('/auth/entrar','POST',{email,senha}));
    }catch(e){setErro((e as Error).message);}finally{setOcupado(false);}
  }
  return <div className="cadastro entrada"><h2>{instalado===false?'Primeiro acesso':recuperar?'Recuperar senha':'Entrar'}</h2>
    {erro&&<p role="alert" className="erro">{erro}</p>}
    {instalado===null?<button onClick={carregar}>Tentar novamente</button>:<>
    {instalado===false&&<p>Cadastre o administrador inicial do EduConnect.</p>}
    {codigoNovo&&<div className="observacao"><p>Guarde este código em um local seguro. Ele permite recuperar sua senha e só aparece agora.</p><textarea readOnly value={codigoNovo} onFocus={e=>e.target.select()}/><button onClick={()=>setCodigoNovo('')}>Já guardei o código</button></div>}
    {!codigoNovo&&<form onSubmit={enviar}><fieldset disabled={ocupado}>
      {!instalado&&<label>Nome<input required value={nome} onChange={e=>setNome(e.target.value)}/></label>}
      <label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {recuperar&&<label>Código de recuperação<input required value={codigo} onChange={e=>setCodigo(e.target.value)}/></label>}
      <label>{recuperar?'Nova senha':'Senha'}<input type="password" minLength={!instalado||recuperar?10:undefined} maxLength={128} autoComplete={!instalado||recuperar?'new-password':'current-password'} required value={senha} onChange={e=>setSenha(e.target.value)}/></label>
      <button type="submit">{ocupado?'Aguarde...':!instalado?'Criar administrador':recuperar?'Redefinir senha':'Entrar'}</button>
      {instalado&&<button type="button" onClick={()=>{setRecuperar(!recuperar);setErro('');setSenha('');}}>{recuperar?'Voltar':'Esqueci minha senha'}</button>}
    </fieldset></form>}</>}
  </div>;
}

const permissoes=['professores','disciplinas','materiais','avaliacoes','presenca','relatorios','financeiro','historico'];
export default function Seguranca(){
  const [usuarios,setUsuarios]=useState<Usuario[]>([]);const [professores,setProfessores]=useState<Professor[]>([]);
  const [form,setForm]=useState<(Omit<Usuario,'id'> & {id?:string;senha:string})|null>(null);const [erro,setErro]=useState('');const [codigo,setCodigo]=useState('');const [ocupado,setOcupado]=useState(false);
  async function carregar(){try{const [u,p]=await Promise.all([api<Usuario[]>('/usuarios'),api<Professor[]>('/professores')]);setUsuarios(u);setProfessores(p);}catch(e){setErro((e as Error).message);}}
  useEffect(()=>{void carregar();},[]);
  async function salvar(e:FormEvent){e.preventDefault();if(!form)return;setOcupado(true);setErro('');try{
    if(form.id)await api(`/usuarios/${form.id}`,'PUT',form);
    else{const r=await api<{codigoRecuperacao:string}>('/usuarios','POST',form);setCodigo(r.codigoRecuperacao);}
    setForm(null);await carregar();
  }catch(e){setErro((e as Error).message);}finally{setOcupado(false);}}
  return <div className="cadastro"><h2>Usuários e permissões</h2><p>O professor acessa somente seus próprios registros e alunos. Administradores têm acesso a todos os módulos.</p>
    {erro&&<p role="alert" className="erro">{erro}</p>}{codigo&&<div className="observacao"><p>Guarde e entregue este código de recuperação ao usuário. Ele aparece apenas uma vez.</p><textarea readOnly value={codigo}/><button onClick={()=>setCodigo('')}>Fechar código</button></div>}
    <button disabled={!!form} onClick={()=>{setErro('');setForm({nome:'',email:'',perfil:'Professor',professorId:'',ativo:true,permissoes:permissoes.filter(p=>p!=='financeiro'),senha:''});}}>Novo usuário</button>
    {form&&<form onSubmit={salvar}><fieldset disabled={ocupado}><div className="campos">
      <label>Nome<input required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label><label>E-mail<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      {!form.id&&<label>Senha inicial<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})}/></label>}
      <label>Perfil<select value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value as Usuario['perfil']})}><option>Professor</option><option>Administrador</option></select></label>
      <label>Professor vinculado<select required={form.perfil==='Professor'} value={form.professorId} onChange={e=>setForm({...form,professorId:e.target.value})}><option value="">Sem vínculo</option>{professores.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Status<select value={String(form.ativo)} onChange={e=>setForm({...form,ativo:e.target.value==='true'})}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
    </div><h4>Módulos permitidos</h4><div className="permissoes">{permissoes.map(p=><label key={p}><input type="checkbox" checked={form.permissoes.includes(p)} onChange={e=>setForm({...form,permissoes:e.target.checked?[...form.permissoes,p]:form.permissoes.filter(v=>v!==p)})}/>{p}</label>)}</div>
    <p>Alterar um usuário encerra as sessões dele. Não é possível desativar o último administrador.</p><div className="acoes"><button type="submit">Salvar</button><button type="button" onClick={()=>setForm(null)}>Cancelar</button></div></fieldset></form>}
    <div className="tabela"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>{usuarios.map(u=><tr key={u.id}><td>{u.nome}</td><td>{u.email}</td><td>{u.perfil}</td><td>{u.ativo?'Ativo':'Inativo'}</td><td><button disabled={!!form} onClick={()=>setForm({...u,senha:''})}>Editar permissões</button></td></tr>)}</tbody></table></div>
  </div>;
}
