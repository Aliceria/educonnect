import { texto, numero, data } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoValido } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { ErroCadastro } from './Professores.ts';

export function validarAvaliacao(d: Dados, banco: Banco, usuario: Usuario, fontes: Fontes) {
  const alunoId = texto(d, 'alunoId');
  alunoValido(fontes, usuario, alunoId);
  const disciplinaId = texto(d, 'disciplinaId');
  banco.buscar('disciplinas', disciplinaId, usuario);
  const notaMaxima = numero(d, 'notaMaxima', 0.01);
  const nota = numero(d, 'nota', 0, notaMaxima);
  const mediaEscolar = numero(d, 'mediaEscolar', 0, notaMaxima);
  const conteudos = texto(d, 'conteudos', false)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const id of conteudos)
    if (banco.buscar('conteudos', id, usuario).dados.disciplinaId !== disciplinaId)
      throw new ErroCadastro('O conteúdo precisa pertencer à disciplina selecionada.');
  return {
    nome: texto(d, 'nome'),
    alunoId,
    disciplinaId,
    data: data(d, 'data'),
    nota,
    notaMaxima,
    mediaEscolar,
    conteudos: conteudos.join(','),
    dificuldades: texto(d, 'dificuldades', false),
    reforcar: texto(d, 'reforcar', false),
  };
}
