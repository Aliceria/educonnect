export const avisoNome = 'Informe um nome com letras; espaços, acentos, hífens e apóstrofos são permitidos.';

export function normalizarNome(valor: string): string {
  const nome = valor.normalize('NFC').trim().replace(/ +/g, ' ');
  if (nome.length > 150 || !/^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u.test(nome))
    throw new Error(avisoNome);
  return nome;
}
