import type { Banco, Usuario } from '../banco.ts';
import type { Fontes } from '../integracao.ts';
import { referencias } from '../integracao.ts';
import { lerConfiguracoes } from './Configuracoes.ts';
import { calcularFrequencia } from './Presenca.ts';
export function resumoDashboard(banco: Banco, usuario: Usuario, fontes: Fontes, instante = new Date()) {
  const ref = referencias(fontes, usuario);
  const hoje = instante.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const mes = hoje.slice(0, 7);
  const inicio = new Date(`${hoje}T12:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 6) % 7);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 6);
  const semana = { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  const frequencia = calcularFrequencia(banco.listar('presencas', usuario)
    .map(r => r.dados)
    .filter(r => String(r.data).startsWith(mes) && String(r.data) <= hoje));
  const planejadas = new Set(banco.listar('planejamentos', usuario).map((p) => p.dados.aulaId));
  const realizadas = ref.aulas.filter(
    (a) =>
      ['Presente', 'Realizada', 'Reposição realizada'].includes(a.status) && a.data.startsWith(mes),
  );
  const agora = instante
    .toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    .replace(' ', 'T')
    .slice(0, 16);
  const proximas = ref.aulas
    .filter((a) => a.data >= agora && a.status === 'Agendada')
    .sort((a, b) => a.data.localeCompare(b.data));
  const financeiro =
    usuario.perfil === 'Administrador' || usuario.permissoes.includes('financeiro');
  const minutos = lerConfiguracoes(banco).lembretesMinutos;
  const lembretes = proximas.filter((a) => {
    const quando = Date.parse(`${a.data}:00-03:00`);
    return quando >= instante.getTime() && quando - instante.getTime() <= minutos * 60000;
  });
  return {
    hoje,
    semana,
    frequencia: { ...frequencia, mes },
    aulasSemana: ref.aulas.filter(a => a.data.slice(0, 10) >= semana.inicio && a.data.slice(0, 10) <= semana.fim),
    alunos: ref.alunos.filter((a) => a.status !== 'Inativo'),
    aulasHoje: ref.aulas.filter((a) => a.data.startsWith(hoje)),
    proximas: proximas.slice(0, 10),
    realizadas: realizadas.length,
    horas: realizadas.reduce((s, a) => s + a.duracaoMinutos, 0) / 60,
    semPlanejamento: proximas.filter((a) => !planejadas.has(a.id)),
    provas: banco
      .listar('avaliacoes', usuario)
      .filter((a) => String(a.dados.data) >= hoje)
      .map((a) => ({ nome: a.dados.nome, data: a.dados.data, alunoId: a.dados.alunoId })),
    lembretes,
    financeiro: financeiro
      ? {
          recebido: ref.pagamentos
            .filter((p) => p.status === 'Recebido' && p.recebidoEm?.startsWith(mes))
            .reduce((s, p) => s + p.valor, 0),
          pendente: ref.pagamentos
            .filter((p) => p.status !== 'Recebido')
            .reduce((s, p) => s + p.valor, 0),
        }
      : null,
  };
}
