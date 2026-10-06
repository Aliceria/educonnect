import { situacaoPagamento } from './Pagamentos.ts';
import type { Banco, Usuario, Dados } from '../banco.ts';
import { texto, escolha, permitir } from '../banco.ts';
import { listarCompartilhamentos } from './Materiais.ts';
export function solicitarPrivacidade(banco: Banco, usuario: Usuario, d: Dados) {
  return banco.salvar(
    'solicitacoes',
    {
      tipo: escolha(d, 'tipo', ['Correção', 'Exclusão', 'Informações sobre tratamento']),
      descricao: texto(d, 'descricao'),
      status: 'Pendente',
      resposta: '',
    },
    usuario,
  );
}
export function responderPrivacidade(banco: Banco, usuario: Usuario, id: string, d: Dados) {
  permitir(usuario, 'seguranca', true);
  const anterior = banco.buscar('solicitacoes', id, usuario);
  return banco.salvar(
    'solicitacoes',
    {
      ...anterior.dados,
      status: escolha(d, 'status', ['Em análise', 'Concluída']),
      resposta: texto(d, 'resposta'),
    },
    usuario,
    id,
    Number(d.versao),
  );
}
export function meusDados(banco: Banco, usuario: Usuario) {
  const portal = ['Aluno', 'Responsável'].includes(usuario.perfil);
  const vinculados = (tipo: string) =>
    portal
      ? banco.db
          .prepare(
            "SELECT id,dados FROM registros WHERE tipo=? AND json_extract(dados,'$.alunoId')=?",
          )
          .all(tipo, usuario.alunoId ?? '')
          .map((r) => ({ id: String(r.id), dados: JSON.parse(String(r.dados)) as Dados }))
      : [];
  const aluno = portal
    ? banco.db
        .prepare("SELECT dados FROM registros WHERE tipo='alunos' AND id=?")
        .get(usuario.alunoId ?? '')
    : undefined;
  const cadastro = aluno ? JSON.parse(String(aluno.dados)) : {};
  const historicoMateriais = portal ? listarCompartilhamentos(banco, usuario) : [];
  const materiais = historicoMateriais.filter(material => material.disponivel)
    .map(material => ({ ...material, ...material.atual }));
  return {
    usuario,
    solicitacoes: banco.listar('solicitacoes', usuario),
    aluno: aluno
      ? Object.fromEntries(
          [
            'nome',
            'idade',
            'telefone',
            'email',
            'responsavel',
            'contatoResponsavel',
            'emailResponsavel',
            'escola',
            'serie',
          ].map((k) => [k, cadastro[k]]),
        )
      : null,
    aulas: vinculados('aulas').map((r) => ({
      id: r.id,
      data: r.dados.data,
      hora: r.dados.hora,
      status: r.dados.status,
      link: r.dados.link,
    })),
    tarefas: vinculados('planejamentos')
      .filter((r) => r.dados.tarefa)
      .map((r) => ({ id: r.id, tarefa: r.dados.tarefa })),
    materiais,
    historicoMateriais,
    pagamentos:
      usuario.perfil === 'Responsável'
        ? vinculados('pagamentos').map((r) => ({
            id: r.id,
            valor: r.dados.valor,
            vencimento: r.dados.vencimento,
            status: situacaoPagamento(r.dados),
          }))
        : [],
  };
}
