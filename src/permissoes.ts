import type { Usuario } from './banco.ts';

export const perfis = ['Administrador', 'Professor', 'Aluno', 'Responsável'] as const;

export const nomesModulos = {
  alunos: 'Alunos',
  agendamento: 'Agenda',
  planejamento: 'Planejamento',
  acompanhamento: 'Acompanhamento',
  pagamentos: 'Pagamentos',
  comunicacao: 'Comunicação',
  areaProfessor: 'Minha área',
  dashboard: 'Dashboard',
  professores: 'Professores',
  disciplinas: 'Disciplinas',
  materiais: 'Materiais',
  avaliacoes: 'Avaliações',
  presenca: 'Presença',
  relatorios: 'Relatórios',
  financeiro: 'Dados financeiros',
  configuracoes: 'Configurações',
  seguranca: 'Segurança',
  historico: 'Histórico',
};

export const modulos = Object.keys(nomesModulos);
export const modulosAdmin = ['configuracoes', 'seguranca'];

export function podeAcessar(usuario: Usuario, modulo: string): boolean {
  if (!modulos.includes(modulo)) return false;
  if (usuario.perfil === 'Administrador') return true;
  if (usuario.perfil !== 'Professor' || modulosAdmin.includes(modulo)) return false;
  return usuario.permissoes.includes(modulo) &&
    (modulo !== 'pagamentos' || usuario.permissoes.includes('financeiro'));
}

export const permissoesRelatorio: Record<string, string[]> = {
  individual: ['alunos', 'avaliacoes', 'presenca', 'disciplinas', 'acompanhamento'],
  responsavel: ['alunos', 'avaliacoes', 'presenca', 'disciplinas', 'acompanhamento'],
  evolucao: ['alunos', 'avaliacoes', 'disciplinas', 'acompanhamento'],
  frequencia: ['alunos', 'presenca'],
  aulas: ['alunos', 'agendamento'],
  canceladas: ['alunos', 'agendamento'],
  conteudos: ['alunos', 'agendamento', 'planejamento'],
  horas: ['alunos', 'agendamento'],
  avaliacoes: ['alunos', 'avaliacoes'],
  financeiro: ['alunos', 'pagamentos', 'financeiro'],
  pendentes: ['alunos', 'pagamentos', 'financeiro'],
  faturamento: ['alunos', 'pagamentos', 'financeiro'],
};

export function podeGerarRelatorio(usuario: Usuario, tipo: string): boolean {
  return podeAcessar(usuario, 'relatorios') && Object.hasOwn(permissoesRelatorio, tipo) &&
    permissoesRelatorio[tipo].every(modulo => podeAcessar(usuario, modulo));
}
