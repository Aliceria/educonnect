import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { ErroCadastro } from './Professores.ts';
import { objeto, texto, modulos, permitir } from '../banco.ts';
import type { Banco, Usuario, Dados } from '../banco.ts';

const derivar = promisify(scrypt);
const resumo = (texto: string) => createHash('sha256').update(texto).digest('hex');
async function hashSenha(senha: string) {
  const sal = randomBytes(16).toString('hex');
  const hash = await derivar(senha, sal, 64) as Buffer;
  return `${sal}:${hash.toString('hex')}`;
}
async function conferir(senha: string, salvo: string) {
  const [sal, hash] = salvo.split(':');
  const calculado = await derivar(senha, sal, 64) as Buffer;
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
function validarSenha(d: Dados) {
  const senha = texto(d, 'senha', true, 128);
  if (senha.length < 10) throw new ErroCadastro('A senha precisa ter pelo menos 10 caracteres.');
  return senha;
}
export function seguranca(banco: Banco) {
  let criandoInicial = false;
  const tentativas = new Map<string, { quantidade: number; ate: number }>();
  function limitar(chave: string) {
    const agora = Date.now();
    for (const [id, item] of tentativas) if (item.ate < agora) tentativas.delete(id);
    const item = tentativas.get(chave) ?? { quantidade: 0, ate: agora + 15 * 60000 };
    if (item.quantidade >= 8) throw new ErroCadastro('Muitas tentativas. Aguarde 15 minutos.', 429);
    item.quantidade++; tentativas.set(chave, item);
  }
  function instalado() { return Number(banco.db.prepare('SELECT count(*) AS n FROM usuarios').get()!.n) > 0; }
  function listar(): Usuario[] { return banco.db.prepare('SELECT dados FROM usuarios').all().map(linha => JSON.parse(String(linha.dados))); }
  function buscar(id: string): Usuario {
    const linha = banco.db.prepare('SELECT dados FROM usuarios WHERE id = ?').get(id);
    if (!linha) throw new ErroCadastro('Usuário não encontrado.', 404);
    return JSON.parse(String(linha.dados));
  }
  function validarUsuario(d: Dados, anterior?: Usuario): Usuario {
    const email = texto(d, 'email', true, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroCadastro('E-mail inválido.');
    if (!['Administrador', 'Professor'].includes(String(d.perfil)) || typeof d.perfil !== 'string') throw new ErroCadastro('Perfil inválido.');
    if (!Array.isArray(d.permissoes) || d.permissoes.some(p => typeof p !== 'string' || !modulos.includes(p))) throw new ErroCadastro('Permissões inválidas.');
    if (typeof d.ativo !== 'boolean') throw new ErroCadastro('Status inválido.');
    const professorId = texto(d, 'professorId', d.perfil === 'Professor', 100);
    if (professorId) {
      const professor = banco.db.prepare('SELECT id FROM professores WHERE id = ?').get(professorId);
      if (!professor) throw new ErroCadastro('Professor não encontrado.');
    }
    return { id: anterior?.id ?? randomUUID(), nome: texto(d, 'nome', true, 150), email, perfil: d.perfil as Usuario['perfil'], professorId, ativo: d.ativo, permissoes: [...new Set(d.permissoes as string[])] };
  }
  async function criar(entrada: unknown, autor?: Usuario) {
    if (autor) permitir(autor, 'seguranca', true);
    const d = objeto(entrada);
    const usuario = validarUsuario(d);
    const senha = await hashSenha(validarSenha(d));
    if (banco.db.prepare('SELECT id FROM usuarios WHERE email = ?').get(usuario.email)) throw new ErroCadastro('E-mail já cadastrado.', 409);
    const codigo = randomBytes(24).toString('hex');
    banco.db.prepare('INSERT INTO usuarios (id,email,dados,senha,recuperacao) VALUES (?,?,?,?,?)')
      .run(usuario.id, usuario.email, JSON.stringify(usuario), senha, resumo(codigo));
    banco.evento(autor ?? usuario, 'seguranca', 'Criação de usuário', usuario.id, { nome: usuario.nome, perfil: usuario.perfil });
    return { usuario, codigoRecuperacao: codigo };
  }
  async function configurar(entrada: unknown) {
    if (instalado() || criandoInicial) throw new ErroCadastro('O administrador inicial já foi configurado.', 409);
    criandoInicial = true;
    try { return await criar({ ...objeto(entrada), perfil: 'Administrador', professorId: '', permissoes: modulos, ativo: true }); }
    finally { criandoInicial = false; }
  }
  function autorizado(usuario: Usuario) {
    if (!usuario.ativo) return false;
    if (usuario.perfil === 'Professor') {
      const linha = banco.db.prepare('SELECT cadastro FROM professores WHERE id = ?').get(usuario.professorId);
      if (!linha || !JSON.parse(String(linha.cadastro)).ativo) return false;
    }
    return true;
  }
  async function entrar(entrada: unknown, ip: string) {
    limitar(`login:${ip}`);
    const d = objeto(entrada);
    const email = texto(d, 'email', true, 254).toLowerCase();
    const senha = texto(d, 'senha', true, 128);
    const linha = banco.db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    const senhaFalsa = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valida = await conferir(senha, linha ? String(linha.senha) : senhaFalsa);
    if (!linha || !valida) throw new ErroCadastro('E-mail ou senha incorretos.', 401);
    const atual = banco.db.prepare('SELECT * FROM usuarios WHERE id=?').get(String(linha.id));
    if (!atual || atual.senha !== linha.senha || atual.dados !== linha.dados) throw new ErroCadastro('O cadastro mudou durante a entrada. Tente novamente.', 401);
    const usuario: Usuario = JSON.parse(String(atual.dados));
    if (!autorizado(usuario)) throw new ErroCadastro('Usuário ou professor inativo.', 403);
    const token = randomBytes(32).toString('hex');
    banco.db.prepare('INSERT INTO sessoes VALUES (?,?,?,?)').run(resumo(token), usuario.id, Date.now(), Date.now());
    tentativas.delete(`login:${ip}`);
    banco.evento(usuario, 'seguranca', 'Entrada', usuario.id);
    return { token, usuario };
  }
  function sessao(token: string, minutos: number): Usuario {
    const linha = banco.db.prepare('SELECT * FROM sessoes WHERE token = ?').get(resumo(token));
    if (!linha || Date.now() - Number(linha.ultimaAtividade) > minutos * 60000 || Date.now() - Number(linha.criada) > 12 * 3600000) {
      banco.db.prepare('DELETE FROM sessoes WHERE token = ?').run(resumo(token));
      throw new ErroCadastro('Sessão encerrada. Entre novamente.', 401);
    }
    const usuario = buscar(String(linha.usuarioId));
    if (!autorizado(usuario)) throw new ErroCadastro('Acesso desativado.', 401);
    banco.db.prepare('UPDATE sessoes SET ultimaAtividade = ? WHERE token = ?').run(Date.now(), resumo(token));
    return usuario;
  }
  function sair(token: string, usuario: Usuario) {
    banco.db.prepare('DELETE FROM sessoes WHERE token = ?').run(resumo(token));
    banco.evento(usuario, 'seguranca', 'Saída', usuario.id);
  }
  function editar(id: string, entrada: unknown, autor: Usuario) {
    permitir(autor, 'seguranca', true);
    const anterior = buscar(id);
    const usuario = validarUsuario(objeto(entrada), anterior);
    if (anterior.perfil === 'Administrador' && anterior.ativo && (usuario.perfil !== 'Administrador' || !usuario.ativo)
      && listar().filter(u => u.perfil === 'Administrador' && u.ativo).length <= 1) throw new ErroCadastro('Mantenha pelo menos um administrador ativo.');
    if (listar().some(u => u.email === usuario.email && u.id !== id)) throw new ErroCadastro('E-mail já cadastrado.', 409);
    banco.db.prepare('UPDATE usuarios SET email=?, dados=? WHERE id=?').run(usuario.email, JSON.stringify(usuario), id);
    banco.db.prepare('DELETE FROM sessoes WHERE usuarioId=?').run(id);
    banco.evento(autor, 'seguranca', 'Permissões alteradas', id, { antes: anterior, depois: usuario });
    return usuario;
  }
  async function recuperar(entrada: unknown, ip: string) {
    limitar(`recuperar:${ip}`);
    const d = objeto(entrada);
    const email = texto(d, 'email', true, 254).toLowerCase();
    const codigo = texto(d, 'codigo', true, 100);
    const linha = banco.db.prepare('SELECT * FROM usuarios WHERE email=?').get(email);
    if (!linha || resumo(codigo) !== linha.recuperacao) throw new ErroCadastro('E-mail ou código de recuperação inválido.', 400);
    const senha = await hashSenha(validarSenha(d));
    const novoCodigo = randomBytes(24).toString('hex');
    const resultado = banco.db.prepare('UPDATE usuarios SET senha=?, recuperacao=? WHERE id=? AND recuperacao=?')
      .run(senha, resumo(novoCodigo), String(linha.id), resumo(codigo));
    if (!resultado.changes) throw new ErroCadastro('Código já utilizado.');
    banco.db.prepare('DELETE FROM sessoes WHERE usuarioId=?').run(String(linha.id));
    banco.evento(JSON.parse(String(linha.dados)), 'seguranca', 'Senha recuperada', String(linha.id));
    return { codigoRecuperacao: novoCodigo };
  }
  return { instalado, configurar, entrar, sessao, sair, listar, criar, editar, recuperar };
}
