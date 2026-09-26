import type { Referencia } from '../Cadastro';
export function horarioFinal(hora: string, duracao: unknown) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return '';
  const minutos = Number(duracao);
  if (!Number.isInteger(minutos) || minutos < 15 || minutos > 480) return '';
  const total = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + minutos;
  if (total > 1440) return 'A duração ultrapassa o fim do dia. Ajuste o início ou a duração.';
  return (
    'Término previsto: ' +
    String(Math.floor(total / 60) % 24).padStart(2, '0') +
    ':' +
    String(total % 60).padStart(2, '0') +
    (total === 1440 ? ' (meia-noite)' : '')
  );
}
export function horarioForaDisponibilidade(dados: Record<string, unknown>, referencias: Record<string, Referencia[]>) {
  if (!dados.data || !dados.hora || !dados.alunoId || !Number.isFinite(Number(dados.duracaoMinutos))) return false;
  const aluno = referencias.alunos?.find((item) => item.id === String(dados.alunoId));
  const professorId = aluno?.professorId;
  const professor = referencias.professores?.find((item) => item.id === professorId);
  const horarios = professor?.horarios ?? [];
  if (!horarios.length) return false;

  const data = new Date(`${String(dados.data)}T12:00:00`);
  const diaSemana = data.getDay();
  const inicio = Number(String(dados.hora).slice(0, 2)) * 60 + Number(String(dados.hora).slice(3));
  const fim = inicio + Number(dados.duracaoMinutos);

  return !horarios.some((horario) => {
    const inicioProfessor = Number(horario.inicio.slice(0, 2)) * 60 + Number(horario.inicio.slice(3));
    const fimProfessor = Number(horario.fim.slice(0, 2)) * 60 + Number(horario.fim.slice(3));
    return horario.dia === diaSemana && inicio >= inicioProfessor && fim <= fimProfessor;
  });
}
