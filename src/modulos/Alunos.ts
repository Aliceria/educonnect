import { texto, numero, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';
import { normalizarTelefone } from '../telefone.ts';
import { normalizarNome } from '../nome.ts';
import { validarSerie } from '../serie.ts';
import { podeAcessar } from '../permissoes.ts';

// Campos do cadastro da Maria, adaptados para o banco compartilhado.
export function validarAluno(d: Dados, banco: Banco, usuario: Usuario) {
  const professorId = usuario.perfil === 'Administrador' ? texto(d, 'professorId') : usuario.professorId;
  const professor = banco.db.prepare('SELECT cadastro FROM professores WHERE id=?').get(professorId);
  if (!professor || !JSON.parse(String(professor.cadastro)).ativo) throw new ErroCadastro('Selecione um professor ativo.');
  const idade = numero(d, 'idade', 1, 120);
  if (!Number.isInteger(idade)) throw new ErroCadastro('Informe uma idade inteira.');
  let responsavel = texto(d, 'responsavel', idade < 18, 150);
  let telefone: string;
  let contatoResponsavel: string;
  let nome: string;
  let serie: string;
  try {
    if (responsavel) responsavel = normalizarNome(responsavel);
    serie = validarSerie(texto(d, 'serie', false));
    nome = normalizarNome(texto(d, 'nome', true, 150));
    telefone = normalizarTelefone(texto(d, 'telefone', false));
    contatoResponsavel = normalizarTelefone(texto(d, 'contatoResponsavel', idade < 18));
  } catch (erro) {
    throw new ErroCadastro((erro as Error).message);
  }
  const modalidade = escolha(d, 'modalidade', ['Presencial', 'On-line', 'Híbrida']);
  const endereco = texto(d, 'endereco', false);
  if (modalidade !== 'On-line' && !endereco)
    throw new ErroCadastro(
      'Informe o endereço do aluno: o campo é obrigatório nas modalidades Presencial e Híbrida e opcional apenas em On-line.',
    );
  return {
    nome, idade, telefone,
    email: texto(d, 'email', false), professorId, responsavel, contatoResponsavel,
    emailResponsavel: texto(d, 'emailResponsavel', false), parentesco: texto(d, 'parentesco', idade < 18),
    autorizacao: texto(d, 'autorizacao', false), escola: texto(d, 'escola', false), serie,
    disciplina: texto(d, 'disciplina'), dificuldade: texto(d, 'dificuldade', false),
    objetivo: texto(d, 'objetivo'),
    modalidade, endereco, disponibilidade: texto(d, 'disponibilidade', false),
    observacoes: texto(d, 'observacoes', false), status: escolha(d, 'status', ['Ativo', 'Inativo']),
  };
}

export function alunoDoUsuario(banco: Banco, usuario: Usuario, id: string, ativo = false) {
  const aluno = banco.buscar('alunos', id, usuario);
  if (ativo && aluno.dados.status !== 'Ativo') throw new ErroCadastro('O aluno está inativo.');
  return aluno;
}

export function historicoAluno(banco: Banco, usuario: Usuario, id: string) {
  const aluno = alunoDoUsuario(banco, usuario, id);
  const categorias: Array<{ tipo: string; permissoes: string[] }> = [
    { tipo: 'aulas', permissoes: ['agendamento'] },
    { tipo: 'planejamentos', permissoes: ['planejamento'] },
    { tipo: 'acompanhamentos', permissoes: ['acompanhamento'] },
    { tipo: 'avaliacoes', permissoes: ['avaliacoes'] },
    { tipo: 'presencas', permissoes: ['presenca'] },
    { tipo: 'aprendizados', permissoes: ['disciplinas'] },
    { tipo: 'pagamentos', permissoes: ['pagamentos', 'financeiro'] },
  ];
  const registros = categorias
    .filter(({ permissoes }) => permissoes.every((modulo) => podeAcessar(usuario, modulo)))
    .flatMap(({ tipo }) =>
      banco.listar(tipo, usuario).filter((registro) => registro.dados.alunoId === id),
    )
    .sort((a, b) =>
      String(b.dados.data ?? b.dados.vencimento ?? b.dados.recebidoEm ?? '').localeCompare(
        String(a.dados.data ?? a.dados.vencimento ?? a.dados.recebidoEm ?? ''),
      ),
    );
  return { aluno, registros };
}
