export const avisoTelefone = 'Informe um telefone com DDD (10 ou 11 dígitos), com +55 opcional.';

export function normalizarTelefone(valor: string): string {
  const entrada = valor.trim();
  if (!entrada) return '';
  if (!/^\+?[0-9 ()-]+$/.test(entrada)) throw new Error(avisoTelefone);
  const digitos = entrada.replace(/\D/g, '');
  const internacional = entrada.startsWith('+') || digitos.length > 11;
  if (internacional && !digitos.startsWith('55')) throw new Error(avisoTelefone);
  const nacional = internacional ? digitos.slice(2) : digitos;
  if (!/^[1-9][0-9][2-9][0-9]{7}$/.test(nacional) &&
      !/^[1-9][0-9]9[0-9]{8}$/.test(nacional)) throw new Error(avisoTelefone);
  return digitos;
}
