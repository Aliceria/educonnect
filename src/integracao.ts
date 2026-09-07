import { ErroCadastro } from './modulos/Professores.ts';
import type { Usuario } from './banco.ts';

// Contrato para os módulos 1–8. Não cria nem altera seus cadastros.
export type Aluno = { id: string; nome: string; professorId: string; responsavel?: string };
export type Aula = { id: string; alunoId: string; professorId: string; data: string; duracaoMinutos: number; status: string; conteudos: string; originalId?: string };
export type Pagamento = { id: string; alunoId: string; professorId: string; vencimento: string; recebidoEm?: string; valor: number; status: 'Pendente' | 'Recebido' | 'Vencido' };
export type Fontes = { alunos: () => Aluno[]; aulas: () => Aula[]; pagamentos: () => Pagamento[] };
export const fontesVazias: Fontes = { alunos: () => [], aulas: () => [], pagamentos: () => [] };
export function referencias(fontes: Fontes, usuario: Usuario) {
  const permitido = (item: { professorId: string }) => usuario.perfil === 'Administrador' || item.professorId === usuario.professorId;
  return { alunos: fontes.alunos().filter(permitido), aulas: fontes.aulas().filter(permitido), pagamentos: fontes.pagamentos().filter(permitido) };
}
export function alunoValido(fontes: Fontes, usuario: Usuario, id: string) {
  const aluno = referencias(fontes, usuario).alunos.find(item => item.id === id);
  if (!aluno) throw new ErroCadastro('Aluno indisponível. O cadastro deve vir do módulo 1.');
  return aluno;
}
