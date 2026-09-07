import { texto, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { referencias } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { ErroCadastro } from './Professores.ts';

export const situacoes = ['Presente', 'Realizada', 'Falta', 'Falta justificada', 'Falta do professor', 'Cancelada pelo aluno', 'Cancelada pelo professor', 'Reagendada', 'Reposição realizada'];
export function validarPresenca(d: Dados, banco: Banco, usuario: Usuario, fontes: Fontes, id?: string) {
  const aulaId = texto(d, 'aulaId');
  const aulas = referencias(fontes, usuario).aulas;
  const aula = aulas.find(item => item.id === aulaId);
  if (!aula) throw new ErroCadastro('Aula indisponível. O agendamento deve vir do módulo 2.');
  const existente = banco.db.prepare("SELECT id FROM registros WHERE tipo='presencas' AND json_extract(dados,'$.aulaId')=? AND id<>?").get(aulaId, id ?? '');
  if (existente) throw new ErroCadastro('A frequência dessa aula já foi registrada. Solicite a edição do registro existente.', 409);
  const status = escolha(d, 'status', situacoes);
  const justificativa = texto(d, 'justificativa', status === 'Falta justificada');
  if (['Presente', 'Realizada', 'Reposição realizada', 'Falta', 'Falta justificada', 'Falta do professor'].includes(status) && aula.data.slice(0,10) > new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) throw new ErroCadastro('A aula ainda não aconteceu.');
  if (status === 'Reposição realizada' && (!aula.originalId || aula.originalId === aula.id || !aulas.some(a => a.id === aula.originalId && a.alunoId === aula.alunoId))) throw new ErroCadastro('A reposição precisa estar vinculada a outra aula do mesmo aluno no agendamento.');
  return { aulaId, alunoId: aula.alunoId, data: aula.data.slice(0,10), status, justificativa, originalId: aula.originalId ?? '' };
}
export function calcularFrequencia(registros: Dados[]) {
  const presentes = registros.filter(r => ['Presente', 'Realizada', 'Reposição realizada'].includes(String(r.status))).length;
  const faltas = registros.filter(r => ['Falta', 'Falta justificada'].includes(String(r.status))).length;
  return { presentes, faltas, percentual: presentes + faltas ? Math.round(presentes / (presentes + faltas) * 10000) / 100 : null };
}
