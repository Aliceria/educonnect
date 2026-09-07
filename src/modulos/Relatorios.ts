import PDFDocument from 'pdfkit';
import type { Banco, Usuario } from '../banco.ts';
import { permitir } from '../banco.ts';
import { referencias } from '../integracao.ts';
import type { Fontes } from '../integracao.ts';
import { calcularFrequencia } from './Presenca.ts';
import { ErroCadastro } from './Professores.ts';

export const tiposRelatorio = {
  individual: 'Relatório individual do aluno', evolucao: 'Evolução pedagógica', frequencia: 'Frequência', aulas: 'Aulas realizadas', canceladas: 'Aulas canceladas',
  conteudos: 'Conteúdos trabalhados', avaliacoes: 'Avaliações e notas', financeiro: 'Relatório financeiro', pendentes: 'Pagamentos pendentes', faturamento: 'Faturamento mensal', horas: 'Horas trabalhadas', responsavel: 'Acompanhamento para o responsável',
};
export type Relatorio = { titulo: string; periodo: string; colunas: string[]; linhas: string[][]; resumo: string[]; avisos: string[] };
export function gerarRelatorio(banco: Banco, usuario: Usuario, fontes: Fontes, params: URLSearchParams): Relatorio {
  const tipo = params.get('tipo') ?? 'individual';
  if (!Object.hasOwn(tiposRelatorio, tipo)) throw new ErroCadastro('Relatório inválido.');
  if (['financeiro', 'pendentes', 'faturamento'].includes(tipo)) permitir(usuario, 'financeiro');
  const inicio = params.get('inicio') ?? ''; const fim = params.get('fim') ?? '';
  for (const valor of [inicio, fim]) if (valor && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor)) || new Date(valor).toISOString().slice(0,10) !== valor)) throw new ErroCadastro('Período inválido.');
  if (inicio && fim && inicio > fim) throw new ErroCadastro('A data inicial deve ser anterior à final.');
  const alunoId = params.get('alunoId') ?? '';
  if (tipo === 'responsavel' && !alunoId) throw new ErroCadastro('Selecione um aluno para o relatório destinado ao responsável.');
  const ref = referencias(fontes, usuario);
  if (alunoId && !ref.alunos.some(a => a.id === alunoId)) throw new ErroCadastro('Aluno não encontrado.');
  const aluno = (id: unknown) => ref.alunos.find(a => a.id === id)?.nome ?? 'Aluno indisponível';
  const selecionado = (id: unknown) => !alunoId || id === alunoId;
  const periodo = (data: unknown) => typeof data === 'string' && (!inicio || data.slice(0,10) >= inicio) && (!fim || data.slice(0,10) <= fim);
  const presencas = banco.listar('presencas', usuario).map(r => r.dados).filter(d => selecionado(d.alunoId) && periodo(d.data));
  const avaliacoes = banco.listar('avaliacoes', usuario).map(r => r.dados).filter(d => selecionado(d.alunoId) && periodo(d.data)).sort((a,b) => String(a.data).localeCompare(String(b.data)));
  const aprendizados = banco.listar('aprendizados', usuario).map(r => r.dados).filter(d => selecionado(d.alunoId));
  const conteudos = banco.listar('conteudos', usuario);
  const aulas = ref.aulas.filter(a => selecionado(a.alunoId) && periodo(a.data)).map(a => ({ ...a, status: presencas.find(p => p.aulaId === a.id)?.status ?? a.status }));
  const realizadas = aulas.filter(a => ['Presente', 'Reposição realizada', 'Realizada'].includes(String(a.status)));
  const rel: Relatorio = { titulo: tiposRelatorio[tipo as keyof typeof tiposRelatorio], periodo: `${inicio || 'Início'} até ${fim || 'sem data final'}`, colunas: [], linhas: [], resumo: [], avisos: [] };
  if (!ref.alunos.length) rel.avisos.push('Aguardando integração com o cadastro de alunos do módulo 1.');
  if (['individual', 'responsavel', 'avaliacoes'].includes(tipo)) {
    rel.colunas = ['Aluno', 'Avaliação', 'Data', 'Nota', 'Aproveitamento', 'Dificuldades / reforço'];
    rel.linhas = avaliacoes.map(a => [aluno(a.alunoId), String(a.nome), String(a.data), `${a.nota} / ${a.notaMaxima}`, `${(Number(a.nota)/Number(a.notaMaxima)*100).toFixed(1)}%`, `${a.dificuldades || ''} ${a.reforcar || ''}`]);
    if (tipo !== 'avaliacoes') {
      for (const a of ref.alunos.filter(a => selecionado(a.id))) {
        const f = calcularFrequencia(presencas.filter(p => p.alunoId === a.id));
        const aprendizado = aprendizados.filter(p => p.alunoId === a.id);
        rel.resumo.push(`${a.nome} — Frequência: ${f.percentual === null ? 'sem registros' : `${f.percentual}%`}; conteúdos dominados: ${aprendizado.filter(p => p.status === 'Dominado').length} de ${aprendizado.length}`);
        for (const p of aprendizado) rel.resumo.push(`${a.nome} — ${conteudos.find(c => c.id === p.conteudoId)?.dados.nome ?? 'Conteúdo indisponível'}: ${p.status}${p.dificuldades ? `; dificuldades: ${p.dificuldades}` : ''}`);
      }
      rel.avisos.push('O aprendizado dos conteúdos mostra a situação atual. O período filtra as avaliações e a frequência.');
    }
  } else if (tipo === 'evolucao') {
    rel.colunas = ['Aluno', 'Data', 'Avaliação', 'Aproveitamento', 'Média escolar', 'Dificuldades'];
    rel.linhas = avaliacoes.map(a => [aluno(a.alunoId), String(a.data), String(a.nome), `${(Number(a.nota)/Number(a.notaMaxima)*100).toFixed(1)}%`, `${a.mediaEscolar} / ${a.notaMaxima}`, String(a.dificuldades)]);
    rel.resumo.push(...aprendizados.map(a => `${aluno(a.alunoId)} — ${conteudos.find(c => c.id === a.conteudoId)?.dados.nome ?? 'Conteúdo indisponível'}: ${a.status}`));
    rel.avisos.push('Notas em ordem cronológica. O resumo dos conteúdos mostra a situação atual, independentemente do período das avaliações.');
  } else if (tipo === 'frequencia') {
    rel.colunas = ['Aluno', 'Data', 'Situação', 'Justificativa'];
    rel.linhas = presencas.map(p => [aluno(p.alunoId), String(p.data), String(p.status), String(p.justificativa)]);
    const f = calcularFrequencia(presencas);
    rel.resumo.push(`Presenças: ${f.presentes}`, `Faltas: ${f.faltas}`, `Frequência: ${f.percentual === null ? 'sem registros' : `${f.percentual}%`}`);
    rel.avisos.push('Cancelamentos, reagendamentos e faltas do professor não entram no cálculo. Faltas justificadas do aluno contam como falta.');
  } else if (['aulas', 'canceladas', 'conteudos', 'horas'].includes(tipo)) {
    const linhas = tipo === 'canceladas' ? aulas.filter(a => String(a.status).startsWith('Cancelad')) : realizadas;
    rel.colunas = ['Aluno', 'Data', 'Situação', 'Duração (min)', 'Conteúdos'];
    rel.linhas = linhas.map(a => [aluno(a.alunoId), a.data, String(a.status), String(a.duracaoMinutos), a.conteudos]);
    rel.resumo.push(`Horas realizadas: ${(realizadas.reduce((s,a) => s+a.duracaoMinutos,0)/60).toFixed(2)}`);
    if (!ref.aulas.length) rel.avisos.push('Aguardando integração com a agenda do módulo 2.');
  } else {
    let pagamentos = ref.pagamentos.filter(p => selecionado(p.alunoId) && periodo(tipo === 'faturamento' ? p.recebidoEm : p.vencimento));
    if (tipo === 'pendentes') pagamentos = pagamentos.filter(p => p.status !== 'Recebido');
    if (tipo === 'faturamento') pagamentos = pagamentos.filter(p => p.status === 'Recebido');
    const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    rel.colunas = ['Aluno', 'Vencimento', 'Recebimento', 'Situação', 'Valor'];
    rel.linhas = pagamentos.map(p => [aluno(p.alunoId), p.vencimento, p.recebidoEm ?? '', p.status, moeda(p.valor)]);
    if (tipo === 'faturamento') {
      const meses = new Map<string, number>();
      for (const p of pagamentos) {
        const mes = p.recebidoEm!.slice(0,7);
        meses.set(mes, (meses.get(mes) ?? 0) + p.valor);
      }
      rel.colunas = ['Mês', 'Total recebido'];
      rel.linhas = [...meses].sort(([a],[b]) => a.localeCompare(b)).map(([mes,total]) => [mes, moeda(total)]);
    }
    rel.resumo.push(`Recebido: ${moeda(pagamentos.filter(p => p.status === 'Recebido').reduce((s,p) => s+p.valor,0))}`, `Pendente: ${moeda(pagamentos.filter(p => p.status !== 'Recebido').reduce((s,p) => s+p.valor,0))}`);
    if (!ref.pagamentos.length) rel.avisos.push('Aguardando integração com os pagamentos do módulo 5.');
  }
  return rel;
}
export async function gerarPdf(relatorio: Relatorio): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 45 });
  const partes: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve, reject) => { doc.on('data', p => partes.push(p)); doc.on('end', () => resolve(Buffer.concat(partes))); doc.on('error', reject); });
  doc.fontSize(18).text('EduConnect').moveDown(0.5);
  doc.fontSize(14).text(relatorio.titulo);
  doc.fontSize(10).text(relatorio.periodo).moveDown();
  for (const linha of [...relatorio.resumo, ...relatorio.avisos]) doc.text(linha).moveDown(0.5);
  if (!relatorio.linhas.length) doc.text('Nenhum registro para os filtros selecionados.');
  for (const linha of relatorio.linhas) {
    if (doc.y > 700) doc.addPage();
    linha.forEach((valor, i) => doc.text(`${relatorio.colunas[i]}: ${valor}`));
    doc.moveDown();
  }
  doc.end();
  return pronto;
}
