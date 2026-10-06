import { randomUUID } from 'node:crypto';
import { texto, escolha, permitir } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoValido, referencias } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { ErroCadastro } from './Professores.ts';

export function referenciasMateriais(banco: Banco, usuario: Usuario) {
  permitir(usuario, 'materiais');
  const materiais = banco.listar('materiais', usuario);
  function listar(tipo: 'disciplinas' | 'conteudos', campo: 'disciplinaId' | 'conteudoId') {
    const ids = new Set([...banco.listar(tipo, usuario).map(r => r.id),
      ...materiais.map(m => String(m.dados[campo] || '')).filter(Boolean)]);
    return banco.db.prepare('SELECT id,dados FROM registros WHERE tipo=? AND id IN (SELECT value FROM json_each(?))')
      .all(tipo, JSON.stringify([...ids])).map(linha => {
        const dados: Dados = JSON.parse(String(linha.dados));
        return { id: String(linha.id), dados: { nome: String(dados.nome),
          ...(tipo === 'conteudos' ? { disciplinaId: String(dados.disciplinaId) } : {}) } };
      });
  }
  return { disciplinas: listar('disciplinas', 'disciplinaId'), conteudos: listar('conteudos', 'conteudoId') };
}

function referenciaValida(banco: Banco, usuario: Usuario, tipo: 'disciplinas' | 'conteudos', id: string) {
  const disponiveis = referenciasMateriais(banco, usuario)[tipo];
  const referencia = disponiveis.find(r => r.id === id);
  if (!referencia) throw new ErroCadastro('Selecione uma disciplina ou conteúdo disponível.');
  return referencia;
}

export function validarMaterial(d: Dados, banco: Banco, usuario: Usuario, fontes: Fontes, id?: string) {
  const anterior = id ? banco.buscar('materiais', id, usuario) : undefined;
  const disciplinaId = texto(d, 'disciplinaId');
  referenciaValida(banco, usuario, 'disciplinas', disciplinaId);
  const conteudoId = texto(d, 'conteudoId', false);
  if (
    conteudoId &&
    referenciaValida(banco, usuario, 'conteudos', conteudoId).dados.disciplinaId !== disciplinaId
  )
    throw new ErroCadastro('Conteúdo de outra disciplina.');
  const aulaId = texto(d, 'aulaId', false);
  const aula = aulaId ? referencias(fontes, usuario).aulas.find(a => a.id === aulaId) : undefined;
  if (aulaId && !aula)
    throw new ErroCadastro('Aula não disponível.');
  const alunoId = texto({ ...d, alunoId: d.alunoId ?? '' }, 'alunoId', false) || aula?.alunoId || '';
  const aluno = alunoId ? alunoValido(fontes, usuario, alunoId) : undefined;
  if (aluno && aluno.status !== 'Ativo') throw new ErroCadastro('Selecione um aluno ativo.');
  if (aula && aula.alunoId !== alunoId) throw new ErroCadastro('A aula pertence a outro aluno.');
  const professorId = aluno?.professorId || String(anterior?.dados.professorId ||
    (usuario.perfil === 'Professor' ? usuario.professorId : ''));
  if (anterior?.dados.professorId && anterior.dados.professorId !== professorId)
    throw new ErroCadastro('Mantenha o professor vinculado ao material.', 409);
  const alunoAnterior = anterior ? String(anterior.dados.alunoId ||
    referencias(fontes, usuario).aulas.find(a => a.id === anterior.dados.aulaId)?.alunoId || '') : '';
  if (anterior && banco.db.prepare('SELECT id FROM compartilhamentos WHERE materialId=? LIMIT 1').get(id!) &&
    (alunoAnterior !== alunoId || anterior.dados.aulaId !== aulaId))
    throw new ErroCadastro('O material já foi compartilhado. Mantenha o aluno e a aula ou cadastre outro material.', 409);
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
    alunoId,
    professorId,
    link,
    descricao: texto(d, 'descricao', false),
    status: escolha(d, 'status', ['Ativo', 'Inativo']),
  };
}
export function guardarAnexo(banco: Banco, usuario: Usuario, id: string, d: Dados) {
  permitir(usuario, 'materiais');
  banco.buscar('materiais', id, usuario);
  const nome = texto(d, 'nome', true, 150).replace(/[\\/\r\n\x00-\x1f]/g, '_');
  const base64 = texto(d, 'base64', true, 7100000);
  if (base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64))
    throw new ErroCadastro('Arquivo inválido. Envie o arquivo completo.');
  const conteudo = Buffer.from(base64, 'base64');
  if (conteudo.toString('base64') !== base64) throw new ErroCadastro('Arquivo inválido.');
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
  permitir(usuario, 'materiais');
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
  if (aluno.status !== 'Ativo') throw new ErroCadastro('Selecione um aluno ativo.');
  const vinculado = String(material.dados.alunoId ||
    referencias(fontes, usuario).aulas.find(a => a.id === material.dados.aulaId)?.alunoId || '');
  if (vinculado && vinculado !== alunoId)
    throw new ErroCadastro('O material está vinculado a outro aluno.');
  const destinatario = escolha(d, 'destinatario', ['Aluno', 'Responsável']);
  if (destinatario === 'Responsável' && !aluno.responsavel)
    throw new ErroCadastro('Aluno sem responsável informado.');
  const existente = banco.db.prepare(
    'SELECT id,data FROM compartilhamentos WHERE materialId=? AND alunoId=? AND destinatario=? AND data>=? ORDER BY data DESC LIMIT 1',
  ).get(id, alunoId, destinatario, new Date(Date.now() - 7 * 86400000).toISOString());
  if (existente) return { caminho: `/api/compartilhados/${existente.id}`, validadeDias: 7,
    expiraEm: new Date(Date.parse(String(existente.data)) + 7 * 86400000).toISOString() };
  const codigo = randomUUID();
  const data = new Date().toISOString();
  banco.db
    .prepare('INSERT INTO compartilhamentos VALUES (?,?,?,?,?,?)')
    .run(codigo, id, alunoId, destinatario, data, usuario.id);
  const disciplina = referenciaValida(banco, usuario, 'disciplinas', String(material.dados.disciplinaId));
  const aula = referencias(fontes, usuario).aulas.find(a => a.id === material.dados.aulaId);
  banco.evento(usuario, 'materiais', 'Link de compartilhamento criado', id, {
    alunoId,
    destinatario,
    compartilhamentoId: codigo,
    nome: material.dados.nome,
    descricao: material.dados.descricao,
    disciplina: disciplina.dados.nome,
    aluno: aluno.nome,
    aula: aula?.data || '',
  });
  return { caminho: `/api/compartilhados/${codigo}`, validadeDias: 7,
    expiraEm: new Date(Date.parse(data) + 7 * 86400000).toISOString() };
}

export function listarCompartilhamentos(banco: Banco, usuario: Usuario, materialId = '') {
  const portal = ['Aluno', 'Responsável'].includes(usuario.perfil);
  if (!portal) permitir(usuario, 'materiais');
  if (materialId && !portal) banco.buscar('materiais', materialId, usuario);
  const linhas = banco.db.prepare(`
    SELECT c.id,c.materialId,c.alunoId,c.destinatario,c.data,c.autorId,m.dados material,
      al.dados aluno,d.dados disciplina,a.dados aula,h.detalhes,h.usuario autor,
      u.dados conta,EXISTS(SELECT 1 FROM anexos WHERE registroId=m.id) temAnexo
    FROM compartilhamentos c JOIN registros m ON m.id=c.materialId AND m.tipo='materiais'
    LEFT JOIN registros al ON al.id=c.alunoId AND al.tipo='alunos'
    LEFT JOIN registros d ON d.id=json_extract(m.dados,'$.disciplinaId') AND d.tipo='disciplinas'
    LEFT JOIN registros a ON a.id=json_extract(m.dados,'$.aulaId') AND a.tipo='aulas'
    LEFT JOIN usuarios u ON u.id=c.autorId
    LEFT JOIN historico h ON h.modulo='materiais' AND h.acao='Link de compartilhamento criado'
      AND json_extract(h.detalhes,'$.compartilhamentoId')=c.id
    WHERE (?='' OR c.materialId=?) AND (
      (?=1 AND c.alunoId=? AND c.destinatario=?) OR
      (?=0 AND (?=1 OR CASE WHEN json_extract(m.dados,'$.professorId') IS NOT NULL
        THEN json_extract(m.dados,'$.professorId')=? ELSE m.autorId=? END)))
    ORDER BY c.data DESC,c.rowid DESC
  `).all(materialId, materialId, portal ? 1 : 0, usuario.alunoId ?? '', usuario.perfil,
    portal ? 1 : 0, usuario.perfil === 'Administrador' ? 1 : 0, usuario.professorId, usuario.id);
  return linhas.map(linha => {
    const material: Dados = JSON.parse(String(linha.material));
    const disciplina: Dados = linha.disciplina ? JSON.parse(String(linha.disciplina)) : {};
    const aula: Dados = linha.aula ? JSON.parse(String(linha.aula)) : {};
    const aluno: Dados = linha.aluno ? JSON.parse(String(linha.aluno)) : {};
    const conta: Dados = linha.conta ? JSON.parse(String(linha.conta)) : {};
    const detalhes: Dados = linha.detalhes ? JSON.parse(String(linha.detalhes)) : {};
    const expiraEm = new Date(Date.parse(String(linha.data)) + 7 * 86400000).toISOString();
    const situacao = material.status !== 'Ativo' ? 'Inativo' : Date.parse(expiraEm) <= Date.now() ? 'Expirado'
      : !linha.temAnexo && !material.link ? 'Sem arquivo' : 'Disponível';
    return { id: String(linha.id), materialId: String(linha.materialId),
      nome: String(detalhes.nome ?? material.nome), descricao: String(detalhes.descricao ?? material.descricao ?? ''),
      alunoId: String(linha.alunoId), aluno: String(detalhes.aluno ?? aluno.nome ?? 'Aluno indisponível'),
      disciplina: String(detalhes.disciplina ?? disciplina.nome ?? 'Indisponível'),
      aula: String(detalhes.aula ?? (aula.data ? `${aula.data}T${aula.hora || ''}` : '')),
      autorId: String(linha.autorId), autor: String(linha.autor ?? conta.nome ?? 'Usuário indisponível'),
      destinatario: String(linha.destinatario), data: String(linha.data), expiraEm, situacao,
      atual: { nome: String(material.nome), descricao: String(material.descricao || ''),
        disciplina: String(disciplina.nome || 'Indisponível'),
        aula: aula.data ? `${aula.data}T${aula.hora || ''}` : '' },
      disponivel: situacao === 'Disponível' };
  });
}
