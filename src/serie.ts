export const series = [
  'Educação infantil',
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}º ano do ensino fundamental`),
  ...Array.from({ length: 3 }, (_, i) => `${i + 1}º ano do ensino médio`),
  'EJA', 'Ensino técnico', 'Ensino superior', 'Pré-vestibular', 'Não se aplica',
];

export function validarSerie(valor: string): string {
  const serie = valor.trim();
  if (serie && !series.includes(serie)) throw new Error('Selecione uma série/ano da lista.');
  return serie;
}
