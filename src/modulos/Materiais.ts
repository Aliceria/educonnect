import { randomUUID } from 'node:crypto';
import { texto, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoValido, referencias } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { ErroCadastro } from './Professores.ts';

export function validarMaterial(d: Dados, banco: Banco, usuario: Usuario, fontes: Fontes) {
  const disciplinaId = texto(d, 'disciplinaId');
  banco.buscar('disciplinas', disciplinaId, usuario);
  const conteudoId = texto(d, 'conteudoId', false);
  if (
    conteudoId &&
    banco.buscar('conteudos', conteudoId, usuario).dados.disciplinaId !== disciplinaId
  )
    throw new ErroCadastro('Conteúdo de outra disciplina.');
  const aulaId = texto(d, 'aulaId', false);
  if (aulaId && !referencias(fontes, usuario).aulas.some((a) => a.id === aulaId))
    throw new ErroCadastro('Aula não disponível.');
  const link = texto(d, 'link', false);
  if (link) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      throw new ErroCadastro('Link inválido.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new ErroCadastro('Use um link HTTP ou HTTPS sem credenciais.');
  }
  return {
    nome: texto(d, 'nome'),
    tipo: escolha(d, 'tipo', [
      'Lista de exercícios',
      'PDF',
      'Imagem',
      'Avaliação',
      'Vídeo',
      'Link',
    ]),
    disciplinaId,
    conteudoId,
    aulaId,
    link,
    descricao: texto(d, 'descricao', false),
    status: escolha(d, 'status', ['Ativo', 'Inativo']),
  };
}
export function guardarAnexo(banco: Banco, usuario: Usuario, id: string, d: Dados) {
  banco.buscar('materiais', id, usuario);
  const nome = texto(d, 'nome', true, 150).replace(/[\\/\r\n\x00-\x1f]/g, '_');
  const base64 = texto(d, 'base64', true, 7100000);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new ErroCadastro('Arquivo inválido.');
  const conteudo = Buffer.from(base64, 'base64');
  if (!conteudo.length || conteudo.length > 5 * 1024 * 1024)
    throw new ErroCadastro('O arquivo deve ter até 5 MB.');
  let mime = '';
  if (conteudo.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
  else if (conteudo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    mime = 'image/png';
  else if (conteudo[0] === 255 && conteudo[1] === 216 && conteudo[2] === 255) mime = 'image/jpeg';
  if (!mime) throw new ErroCadastro('Envie PDF, PNG ou JPEG.');
  banco.db
    .prepare(
      'INSERT INTO anexos VALUES (?,?,?,?) ON CONFLICT(registroId) DO UPDATE SET nome=excluded.nome,mime=excluded.mime,conteudo=excluded.conteudo',
    )
    .run(id, nome, mime, conteudo);
  banco.evento(usuario, 'materiais', 'Anexo atualizado', id, { nome, tamanho: conteudo.length });
  return { nome, tamanho: conteudo.length };
}
export function compartilharMaterial(
  banco: Banco,
  usuario: Usuario,
  id: string,
  d: Dados,
  fontes: Fontes,
) {
  const material = banco.buscar('materiais', id, usuario);
  if (material.dados.status !== 'Ativo')
    throw new ErroCadastro('Ative o material antes de compartilhar.');
  if (
    !material.dados.link &&
    !banco.db.prepare('SELECT registroId FROM anexos WHERE registroId=?').get(id)
  )
    throw new ErroCadastro('Adicione um arquivo ou link primeiro.');
  const alunoId = texto(d, 'alunoId');
  const aluno = alunoValido(fontes, usuario, alunoId);
  const destinatario = escolha(d, 'destinatario', ['Aluno', 'Responsável']);
  if (destinatario === 'Responsável' && !aluno.responsavel)
    throw new ErroCadastro('Aluno sem responsável informado.');
  const codigo = randomUUID();
  banco.db
    .prepare('INSERT INTO compartilhamentos VALUES (?,?,?,?,?,?)')
    .run(codigo, id, alunoId, destinatario, new Date().toISOString(), usuario.id);
  banco.evento(usuario, 'materiais', 'Link de compartilhamento criado', id, {
    alunoId,
    destinatario,
  });
  return { caminho: `/api/compartilhados/${codigo}`, validadeDias: 7 };
}
