export const avisoDisciplina = 'Use nomes de disciplinas com letras; números, espaços, hífens e apóstrofos podem complementar o nome.';

export function normalizarDisciplina(valor: string): string {
  const nome = valor.normalize('NFC').trim().replace(/ +/g, ' ');
  if (nome.length > 100 || !/\p{L}/u.test(nome) ||
      !/^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[ '\u2019-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u.test(nome))
    throw new Error(avisoDisciplina);
  return nome;
}
