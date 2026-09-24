import type { Banco, Usuario } from '../banco.ts';
import type { Fontes } from '../integracao.ts';
import { referencias } from '../integracao.ts';
import { lerConfiguracoes } from './Configuracoes.ts';
import { calcularFrequencia } from './Presenca.ts';

export function resumoDashboard(banco: Banco, usuario: Usuario, fontes: Fontes, instante = new Date()) {
  const permitido = (modulo: string) => usuario.perfil === 'Administrador' ||
    (usuario.perfil === 'Professor' && usuario.permissoes.includes(modulo));
  const permissoes = {
    alunos: permitido('alunos'), agendamento: permitido('agendamento'),
    presenca: permitido('presenca'), planejamento: permitido('planejamento'),
    avaliacoes: permitido('avaliacoes'), financeiro: permitido('financeiro'),
  };
  const ref = referencias(fontes, usuario);
  const dataValida = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor;
  const aulas = permissoes.agendamento ? ref.aulas
    .filter(a => dataValida(a.data.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(a.data))
    .map(a => ({ ...a, conteudos: permissoes.planejamento ? a.conteudos : '' })) : [];
  const nomeAluno = (id: string) => permissoes.alunos ?
    ref.alunos.find(a => a.id === id)?.nome || 'Aluno' : 'Aluno';
  const hoje = instante.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const mes = hoje.slice(0, 7);
  const inicio = new Date(`${hoje}T12:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 6) % 7);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 6);
  const semana = { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  const frequencia = permissoes.presenca ? {
    ...calcularFrequencia(banco.listar('presencas', usuario).map(r => r.dados)
      .filter(r => dataValida(String(r.data)) && String(r.data).startsWith(mes) && String(r.data) <= hoje)), mes,
  } : null;
  const planos = permissoes.planejamento ? banco.listar('planejamentos', usuario) : [];
  const planejadas = new Map(planos.map(p => [String(p.dados.aulaId), p]));
  const realizadas = aulas.filter(a =>
    ['Presente', 'Realizada', 'Reposição realizada'].includes(a.status) &&
    a.data.startsWith(mes) && a.data.slice(0, 10) <= hoje);
  const agora = instante.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16);
  const proximas = aulas.filter(a => a.data >= agora && a.status === 'Agendada')
    .sort((a, b) => a.data.localeCompare(b.data));
  const pagamentos = permissoes.financeiro ? ref.pagamentos.filter(p => Number.isFinite(p.valor) && p.valor >= 0) : [];
  const somarPagamentos = (filtro: (p: (typeof pagamentos)[number]) => boolean) =>
    pagamentos.filter(filtro).reduce((s, p) => s + Math.round(p.valor * 100), 0) / 100;
  const minutos = lerConfiguracoes(banco).lembretesMinutos;
  const lembretes = proximas.filter(a => {
    const quando = Date.parse(`${a.data}:00-03:00`);
    return quando >= instante.getTime() && quando - instante.getTime() <= minutos * 60000;
  });
  const alunosPermitidos = new Set(ref.alunos.map(a => a.id));
  const avaliacoes = permissoes.avaliacoes ? banco.listar('avaliacoes', usuario)
    .filter(a => alunosPermitidos.has(String(a.dados.alunoId)) && dataValida(String(a.dados.data))) : [];
  const historico = avaliacoes.filter(a => String(a.dados.data) <= hoje &&
    typeof a.dados.nota === 'number' && Number.isFinite(a.dados.nota) &&
    typeof a.dados.notaMaxima === 'number' && Number.isFinite(a.dados.notaMaxima) &&
    a.dados.notaMaxima > 0 && a.dados.nota >= 0 && a.dados.nota <= a.dados.notaMaxima)
    .sort((a, b) => String(a.dados.data).localeCompare(String(b.dados.data)) || a.id.localeCompare(b.id));
  const evolucao = [...new Set(historico.map(a => String(a.dados.alunoId)))].map(alunoId => ({
    alunoId, nome: nomeAluno(alunoId), pontos: historico.filter(a => a.dados.alunoId === alunoId)
      .map(a => ({ id: a.id, nome: String(a.dados.nome), data: String(a.dados.data),
        percentual: Math.round(Number(a.dados.nota) / Number(a.dados.notaMaxima) * 10000) / 100 })),
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const tarefas = permissoes.planejamento ? aulas.flatMap(a => {
    const plano = planejadas.get(a.id);
    if (a.status === 'Agendada' && !plano) return [{ id: a.id, tipo: 'Planejamento',
      descricao: 'Preparar planejamento da aula', aluno: nomeAluno(a.alunoId), data: a.data }];
    if (['Presente', 'Realizada', 'Reposição realizada'].includes(a.status) &&
      !String((plano ? plano.dados.trabalhado : a.conteudos) || '').trim()) return [{ id: a.id, tipo: 'Registro',
      descricao: 'Registrar conteúdo trabalhado', aluno: nomeAluno(a.alunoId), data: a.data }];
    return [];
  }).sort((a, b) => a.data.localeCompare(b.data)) : [];
  const provas = avaliacoes.filter(a => String(a.dados.data) >= hoje)
    .sort((a, b) => String(a.dados.data).localeCompare(String(b.dados.data)))
    .map(a => ({ id: a.id, nome: String(a.dados.nome), data: String(a.dados.data), alunoId: String(a.dados.alunoId) }));
  const eventos = [
    ...proximas.map(a => ({ id: a.id, tipo: 'Aula' as const, nome: 'Aula agendada', aluno: nomeAluno(a.alunoId), data: a.data })),
    ...provas.map(a => ({ id: a.id, tipo: 'Avaliação' as const, nome: a.nome, aluno: nomeAluno(a.alunoId), data: a.data })),
  ].sort((a, b) => a.data.localeCompare(b.data));
  return {
    hoje, semana, permissoes, frequencia, evolucao, tarefas, eventos,
    aulasSemana: aulas.filter(a => a.data.slice(0, 10) >= semana.inicio && a.data.slice(0, 10) <= semana.fim),
    alunos: permissoes.alunos ? ref.alunos.filter(a => a.status === 'Ativo') : [],
    aulasHoje: aulas.filter(a => a.data.startsWith(hoje)), proximas: proximas.slice(0, 10),
    realizadas: realizadas.length,
    horas: realizadas.reduce((s, a) => s + (Number.isFinite(a.duracaoMinutos) && a.duracaoMinutos > 0 ? a.duracaoMinutos : 0), 0) / 60,
    semPlanejamento: permissoes.planejamento ? proximas.filter(a => !planejadas.has(a.id)) : [],
    provas, lembretes,
    financeiro: permissoes.financeiro ? {
      recebido: somarPagamentos(p => p.status === 'Recebido' && !!p.recebidoEm &&
        dataValida(p.recebidoEm) && p.recebidoEm.startsWith(mes) && p.recebidoEm <= hoje),
      pendente: somarPagamentos(p => p.status !== 'Recebido' && dataValida(p.vencimento) && p.vencimento >= hoje),
      atrasado: somarPagamentos(p => p.status !== 'Recebido' && dataValida(p.vencimento) && p.vencimento < hoje),
    } : null,
  };
}
