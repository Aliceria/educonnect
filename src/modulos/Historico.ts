import type { Banco, Usuario } from '../banco.ts';
import { data } from '../banco.ts';
import { ErroCadastro } from './Professores.ts';
export function consultarHistorico(banco: Banco, usuario: Usuario, parametros: URLSearchParams) {
  const pagina = Number(parametros.get('pagina') ?? 1);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000)
    throw new ErroCadastro('Página inválida.');
  const inicio = parametros.get('inicio') ?? '';
  const fim = parametros.get('fim') ?? '';
  if (inicio) data({ inicio }, 'inicio');
  if (fim) data({ fim }, 'fim');
  if (inicio && fim && inicio > fim)
    throw new ErroCadastro('A data inicial deve ser anterior à final.');
  const permissoes: Record<string, string> = {
    alunos:'alunos', aulas:'agendamento', planejamentos:'planejamento', modelos:'planejamento', acompanhamentos:'acompanhamento', necessidades:'acompanhamento', pacotes:'financeiro', comunicacoes:'comunicacao', solicitacoes:'areaProfessor',
    professores: 'professores',
    disciplinas: 'disciplinas',
    conteudos: 'disciplinas',
    aprendizados: 'disciplinas',
    materiais: 'materiais',
    avaliacoes: 'avaliacoes',
    presencas: 'presenca',
    relatorios: 'relatorios',
    pagamentos: 'financeiro',
  };
  const visiveis = Object.keys(permissoes).filter((m) =>
    usuario.permissoes.includes(permissoes[m]),
  );
  const linhas = banco.db
    .prepare(
      `SELECT * FROM historico WHERE (? = 1 OR usuarioId = ?)
    AND (? = 1 OR modulo IN (SELECT value FROM json_each(?)) OR (modulo = 'seguranca' AND acao IN ('Entrada','Saída','Senha recuperada')))
    AND (? = 1 OR modulo <> 'relatorios' OR coalesce(json_extract(detalhes,'$.tipo'),'') NOT IN ('financeiro','pendentes','faturamento'))
    AND (? = '' OR modulo = ?) AND (? = '' OR substr(data,1,10) >= ?) AND (? = '' OR substr(data,1,10) <= ?)
    ORDER BY id DESC LIMIT 100 OFFSET ?`,
    )
    .all(
      usuario.perfil === 'Administrador' ? 1 : 0,
      usuario.id,
      usuario.perfil === 'Administrador' ? 1 : 0,
      JSON.stringify(visiveis),
      usuario.perfil === 'Administrador' || usuario.permissoes.includes('financeiro') ? 1 : 0,
      parametros.get('modulo') ?? '',
      parametros.get('modulo') ?? '',
      inicio,
      inicio,
      fim,
      fim,
      (pagina - 1) * 100,
    );
  return linhas.map((r) => ({ ...r, detalhes: JSON.parse(String(r.detalhes)) }));
}
