import { texto, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';

export function validarModelo(d: Dados) {
  return {
    nome: texto(d, 'nome'),
    previsto: texto(d, 'previsto'),
    objetivos: texto(d, 'objetivos'),
    metodologia: texto({ ...d, metodologia: d.metodologia ?? '' }, 'metodologia', false),
    atividades: texto({ ...d, atividades: d.atividades ?? '' }, 'atividades', false),
  };
}

export function validarPlanejamento(d: Dados, banco: Banco, usuario: Usuario, id?: string) {
  const aulaId = texto(d, 'aulaId');
  const aula = banco.buscar('aulas', aulaId, usuario);
  const duplicado = banco.db
    .prepare(
      `SELECT id
       FROM registros
       WHERE tipo = 'planejamentos'
         AND json_extract(dados, '$.aulaId') = ?
         AND id <> ?`,
    )
    .get(aulaId, id ?? '');

  if (duplicado) {
    throw new ErroCadastro('Essa aula já tem planejamento. Edite o existente.', 409);
  }

  const conteudos = texto(d, 'conteudos', false);
  for (const conteudoId of conteudos.split(',').filter(Boolean)) {
    banco.buscar('conteudos', conteudoId, usuario);
  }

  const materiais = texto(d, 'materiais', false);
  for (const materialId of materiais.split(',').filter(Boolean)) {
    banco.buscar('materiais', materialId, usuario);
  }

  return {
    aulaId,
    alunoId: aula.dados.alunoId,
    professorId: aula.dados.professorId,
    nome: aula.dados.nome,
    previsto: texto(d, 'previsto'),
    objetivos: texto(d, 'objetivos'),
    metodologia: texto({ ...d, metodologia: d.metodologia ?? '' }, 'metodologia', false),
    atividades: texto({ ...d, atividades: d.atividades ?? '' }, 'atividades', false),
    conteudos,
    materiais,
    trabalhado: texto(d, 'trabalhado', false),
    resultado: texto({ ...d, resultado: d.resultado ?? '' }, 'resultado', false),
    observacoes: texto({ ...d, observacoes: d.observacoes ?? '' }, 'observacoes', false),
    statusConteudo: escolha(
      { ...d, statusConteudo: d.statusConteudo || 'Planejado' },
      'statusConteudo',
      ['Planejado', 'Em andamento', 'Concluído'],
    ),
    tarefa: texto(d, 'tarefa', false),
    retomar: texto(d, 'retomar', false),
  };
}
