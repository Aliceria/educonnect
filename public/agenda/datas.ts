export type Periodo = 'Dia' | 'Semana' | 'Mês';
export const periodos: Periodo[] = ['Dia', 'Semana', 'Mês'];
export const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const ler = (dia: string) => new Date(`${dia}T12:00:00Z`);
const iso = (data: Date) => data.toISOString().slice(0, 10);
export const formatarData = (dia: string) => dia.split('-').reverse().join('/');
export function limitesPeriodo(dia: string, periodo: Periodo) {
  const inicio = ler(dia);
  const fim = ler(dia);
  if (periodo === 'Semana') {
    inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 6) % 7);
    fim.setTime(inicio.getTime());
    fim.setUTCDate(fim.getUTCDate() + 6);
  } else if (periodo === 'Mês') {
    inicio.setUTCDate(1);
    fim.setUTCMonth(fim.getUTCMonth() + 1, 0);
  }
  return { inicio: iso(inicio), fim: iso(fim) };
}
export function navegarData(dia: string, periodo: Periodo, direcao: number) {
  const data = ler(dia);
  if (periodo === 'Mês') {
    const original = data.getUTCDate();
    data.setUTCDate(1);
    data.setUTCMonth(data.getUTCMonth() + direcao);
    const ultimo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
    data.setUTCDate(Math.min(original, ultimo));
  } else data.setUTCDate(data.getUTCDate() + direcao * (periodo === 'Semana' ? 7 : 1));
  return iso(data);
}
export function classeStatus(status: string) {
  if (status.startsWith('Cancelada')) return 'cancelada';
  return ({ Agendada: 'agendada', Realizada: 'realizada', Falta: 'falta',
    'Falta justificada': 'justificada', 'Falta do professor': 'professor',
    Reagendada: 'reagendada', 'Reposição': 'reposicao', 'Reposição realizada': 'reposicao' } as Record<string, string>)[status] ?? 'agendada';
}
