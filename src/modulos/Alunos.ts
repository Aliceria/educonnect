import { texto, numero, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';

// Campos do cadastro da Maria, adaptados para o banco compartilhado.
export function validarAluno(d: Dados, banco: Banco, usuario: Usuario) {
  const professorId = usuario.perfil === 'Administrador' ? texto(d, 'professorId') : usuario.professorId;
  const professor = banco.db.prepare('SELECT cadastro FROM professores WHERE id=?').get(professorId);
  if (!professor || !JSON.parse(String(professor.cadastro)).ativo) throw new ErroCadastro('Selecione um professor ativo.');
  const idade = numero(d, 'idade', 1, 120);
  if (!Number.isInteger(idade)) throw new ErroCadastro('Informe uma idade inteira.');
  const responsavel = texto(d, 'responsavel', idade < 18);
  const contatoResponsavel = texto(d, 'contatoResponsavel', idade < 18);
  return {
    nome: texto(d, 'nome', true, 150), idade, telefone: texto(d, 'telefone', false),
    email: texto(d, 'email', false), professorId, responsavel, contatoResponsavel,
    emailResponsavel: texto(d, 'emailResponsavel', false), parentesco: texto(d, 'parentesco', idade < 18),
    autorizacao: texto(d, 'autorizacao', false), escola: texto(d, 'escola', false), serie: texto(d, 'serie', false),
    disciplina: texto(d, 'disciplina'), dificuldade: texto(d, 'dificuldade', false),
    objetivo: texto(d, 'objetivo'), modalidade: escolha(d, 'modalidade', ['Presencial', 'On-line', 'Híbrida']),
    endereco: texto(d, 'endereco', false), disponibilidade: texto(d, 'disponibilidade', false),
    observacoes: texto(d, 'observacoes', false), status: escolha(d, 'status', ['Ativo', 'Inativo']),
  };
}

export function alunoDoUsuario(banco: Banco, usuario: Usuario, id: string, ativo = false) {
  const aluno = banco.buscar('alunos', id, usuario);
  if (ativo && aluno.dados.status !== 'Ativo') throw new ErroCadastro('O aluno está inativo.');
  return aluno;
}

export function historicoAluno(banco:Banco,usuario:Usuario,id:string) {
 const aluno=alunoDoUsuario(banco,usuario,id);
 const tipos:Record<string,string>={aulas:'agendamento',planejamentos:'planejamento',acompanhamentos:'acompanhamento',avaliacoes:'avaliacoes',presencas:'presenca',aprendizados:'disciplinas',pagamentos:'financeiro'};
 const registros=Object.entries(tipos).filter(([,permissao])=>usuario.perfil==='Administrador'||usuario.permissoes.includes(permissao)).flatMap(([tipo])=>banco.listar(tipo,usuario).filter(r=>r.dados.alunoId===id));
 return {aluno,registros:registros.sort((a,b)=>String(b.dados.data??b.dados.vencimento??'').localeCompare(String(a.dados.data??a.dados.vencimento??'')))};
}
