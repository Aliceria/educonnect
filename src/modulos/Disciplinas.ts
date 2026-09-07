import { texto, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoValido } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { ErroCadastro } from './Professores.ts';

export function validarDisciplina(d: Dados) {
  return { nome: texto(d, 'nome', true, 100), descricao: texto(d, 'descricao', false), status: escolha(d, 'status', ['Ativa', 'Inativa']) };
}
export function validarConteudo(d: Dados, banco: Banco, usuario: Usuario, registroId?: string) {
  const disciplinaId = texto(d, 'disciplinaId');
  banco.buscar('disciplinas', disciplinaId, usuario);
  const relacionados = [...new Set(texto(d, 'relacionados', false).split(',').map(v => v.trim()).filter(Boolean))];
  if (registroId && relacionados.includes(registroId)) throw new ErroCadastro('O conteúdo não pode ser relacionado a si mesmo.');
  if (registroId && banco.buscar('conteudos', registroId, usuario).dados.disciplinaId !== disciplinaId) {
    const vinculado = banco.db.prepare("SELECT 1 FROM registros WHERE (tipo='materiais' AND json_extract(dados,'$.conteudoId')=?) OR (tipo='avaliacoes' AND instr(',' || json_extract(dados,'$.conteudos') || ',', ',' || ? || ',')>0) LIMIT 1").get(registroId, registroId);
    if (vinculado) throw new ErroCadastro('Este conteúdo já está vinculado a materiais ou avaliações. Remova esses vínculos antes de trocar a disciplina.', 409);
  }
  for (const id of relacionados) banco.buscar('conteudos', id, usuario);
  return { nome: texto(d, 'nome', true, 150), disciplinaId, classificacao: texto(d, 'classificacao'), dificuldade: escolha(d, 'dificuldade', ['Básico', 'Intermediário', 'Avançado']), relacionados: relacionados.join(',') };
}
export function validarAprendizado(d: Dados, banco: Banco, usuario: Usuario, fontes: Fontes, id?: string) {
  const alunoId = texto(d, 'alunoId');
  alunoValido(fontes, usuario, alunoId);
  const conteudoId = texto(d, 'conteudoId');
  banco.buscar('conteudos', conteudoId, usuario);
  if (banco.listar('aprendizados', usuario).some(r => r.id !== id && r.dados.alunoId === alunoId && r.dados.conteudoId === conteudoId)) throw new ErroCadastro('Esse aluno já tem um registro para o conteúdo. Edite o registro existente.', 409);
  return { alunoId, conteudoId, status: escolha(d, 'status', ['Não iniciado', 'Em andamento', 'Dominado']), dificuldades: texto(d, 'dificuldades', false) };
}
