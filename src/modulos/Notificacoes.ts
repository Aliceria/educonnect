import { createHash } from 'node:crypto';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { lerConfiguracoes } from './Configuracoes.ts';
import { ErroCadastro } from './Professores.ts';

export type TipoNotificacao = 'aula' | 'pagamento' | 'avaliacao' | 'material' | 'planejamento';
export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  data: string;
  lida: boolean;
};
export type ListaNotificacoes = { notificacoes: Notificacao[]; naoLidas: number };
type Aviso = Omit<Notificacao, 'data' | 'lida'>;
const diaMs = 86400000;
const formatarDia = (dia: unknown) => String(dia).split('-').reverse().join('/');

// Os avisos são derivados dos registros acessíveis, e a leitura pertence à conta.
// Nenhum identificador de usuário recebido do navegador é utilizado.
export function listarNotificacoes(banco: Banco, usuario: Usuario, agora = new Date()): ListaNotificacoes {
  const portal = ['Aluno', 'Responsável'].includes(usuario.perfil);
  const pode = (modulo: string) => usuario.perfil === 'Administrador' || (!portal && usuario.permissoes.includes(modulo));
  const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const daquiUmaSemana = new Date(Date.parse(hoje + 'T12:00:00Z') + 7 * diaMs).toISOString().slice(0, 10);
  const avisos: Aviso[] = [];
  function adicionar(chave: string, tipo: TipoNotificacao, titulo: string, mensagem: string, prioridade: Aviso['prioridade']) {
    const id = createHash('sha256').update(chave).digest('hex');
    avisos.push({ id, tipo, titulo, mensagem, prioridade });
  }
  function registros(tipo: string): { id: string; dados: Dados }[] {
    if (!portal) return banco.listar(tipo, usuario);
    if (!usuario.alunoId) return [];
    return banco.db.prepare("SELECT id,dados FROM registros WHERE tipo=? AND json_extract(dados,'$.alunoId')=?")
      .all(tipo, usuario.alunoId).map(r => ({ id: String(r.id), dados: JSON.parse(String(r.dados)) as Dados }));
  }
  const alunos = !portal && pode('alunos') ? new Map(banco.listar('alunos', usuario).map(a => [a.id, String(a.dados.nome)])) : new Map<string, string>();
  const deAluno = (d: Dados) => portal ? '' : ` — ${alunos.get(String(d.alunoId)) ?? 'Aluno vinculado'}`;
  const aulas = portal || pode('agendamento') ? registros('aulas') : [];
  const antecedencia = lerConfiguracoes(banco).lembretesMinutos * 60000;
  for (const aula of aulas) {
    const d = aula.dados;
    const instante = Date.parse(`${d.data}T${d.hora}:00-03:00`);
    if (d.status === 'Agendada' && instante >= agora.getTime() && instante <= agora.getTime() + antecedencia) {
      adicionar(`aula:${aula.id}:${d.data}:${d.hora}`, 'aula', 'Aula próxima',
        `Aula em ${formatarDia(d.data)} às ${d.hora}${deAluno(d)}.`, 'Alta');
    }
  }
  if (usuario.perfil === 'Responsável' || (pode('pagamentos') && pode('financeiro'))) {
    for (const pagamento of registros('pagamentos')) {
      const d = pagamento.dados;
      if (d.status === 'Recebido' || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.vencimento)) || String(d.vencimento) > daquiUmaSemana) continue;
      const atrasado = String(d.vencimento) < hoje;
      adicionar(`pagamento:${pagamento.id}:${d.vencimento}:${atrasado ? 'atrasado' : 'proximo'}`, 'pagamento',
        atrasado ? 'Pagamento atrasado' : 'Pagamento próximo',
        `${String(d.nome)}${deAluno(d)}: vencimento em ${formatarDia(d.vencimento)}.`, atrasado ? 'Alta' : 'Média');
    }
  }
  // Avaliações seguem a permissão do módulo. O portal atual não libera avaliações.
  if (pode('avaliacoes')) {
    for (const avaliacao of registros('avaliacoes')) {
      if (recente('avaliacoes', avaliacao.id)) adicionar(`avaliacao:${avaliacao.id}`, 'avaliacao', 'Nova avaliação',
        `${avaliacao.dados.nome}${deAluno(avaliacao.dados)} — ${formatarDia(avaliacao.dados.data)}.`, 'Média');
    }
  }
  if (portal && usuario.alunoId) {
    const materiais = banco.db.prepare("SELECT c.id,c.data,r.dados FROM compartilhamentos c JOIN registros r ON r.id=c.materialId AND r.tipo='materiais' WHERE c.alunoId=? AND c.destinatario=? AND c.data>=? AND c.data<=? AND json_extract(r.dados,'$.status')='Ativo'")
      .all(usuario.alunoId, usuario.perfil, new Date(agora.getTime() - 7 * diaMs).toISOString(), agora.toISOString());
    for (const m of materiais) adicionar(`compartilhamento:${m.id}`, 'material', 'Novo material compartilhado',
      `${JSON.parse(String(m.dados)).nome} está disponível na sua área.`, 'Baixa');
  } else if (pode('materiais')) {
    for (const material of registros('materiais')) {
      if (material.dados.status === 'Ativo' && recente('materiais', material.id)) adicionar(`material:${material.id}`, 'material', 'Novo material',
        `${material.dados.nome} foi adicionado à biblioteca.`, 'Baixa');
    }
  }
  if (pode('planejamento') && pode('agendamento')) {
    const planejadas = new Set(registros('planejamentos').map(p => p.dados.aulaId));
    for (const aula of aulas) {
      const d = aula.dados;
      if (d.status === 'Agendada' && String(d.data) <= daquiUmaSemana &&
          Date.parse(`${d.data}T${d.hora}:00-03:00`) >= agora.getTime() && !planejadas.has(aula.id)) {
        adicionar(`planejamento:${aula.id}:${d.data}:${d.hora}`, 'planejamento', 'Planejamento pendente',
          `Prepare a aula de ${formatarDia(d.data)} às ${d.hora}${deAluno(d)}.`, 'Média');
      }
    }
  }
  function recente(tipo: string, id: string) {
    const evento = banco.db.prepare("SELECT data FROM historico WHERE registroId=? AND modulo=? AND acao='Cadastro' ORDER BY id LIMIT 1").get(id, tipo);
    // Registros antigos sem data de criação não geram um aviso de novidade.
    if (!evento) return false;
    const idade = agora.getTime() - Date.parse(String(evento.data));
    return idade >= 0 && idade <= 30 * diaMs;
  }
  const guardar = banco.db.prepare('INSERT INTO notificacoes_leituras (usuarioId,id,criadaEm,lidaEm) VALUES (?,?,?,NULL) ON CONFLICT(usuarioId,id) DO NOTHING');
  for (const aviso of avisos) guardar.run(usuario.id, aviso.id, agora.toISOString());
  const estados = new Map(banco.db.prepare('SELECT id,criadaEm,lidaEm FROM notificacoes_leituras WHERE usuarioId=?').all(usuario.id).map(r => [String(r.id), r]));
  const notificacoes = avisos.map(aviso => ({ ...aviso, data: String(estados.get(aviso.id)!.criadaEm), lida: estados.get(aviso.id)!.lidaEm !== null }));
  const ordem = { Alta: 0, Média: 1, Baixa: 2 };
  notificacoes.sort((a, b) => Number(a.lida) - Number(b.lida) || ordem[a.prioridade] - ordem[b.prioridade] || b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
  return { notificacoes, naoLidas: notificacoes.filter(n => !n.lida).length };
}

export function marcarNotificacoes(banco: Banco, usuario: Usuario, id?: string, agora = new Date()): ListaNotificacoes {
  const lista = listarNotificacoes(banco, usuario, agora);
  if (id && !lista.notificacoes.some(n => n.id === id)) throw new ErroCadastro('Notificação não encontrada.', 404);
  const marcar = banco.db.prepare('UPDATE notificacoes_leituras SET lidaEm=coalesce(lidaEm,?) WHERE usuarioId=? AND id=?');
  for (const n of lista.notificacoes) if (!id || n.id === id) marcar.run(agora.toISOString(), usuario.id, n.id);
  return listarNotificacoes(banco, usuario, agora);
}
