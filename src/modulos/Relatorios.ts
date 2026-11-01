import PDFDocument from 'pdfkit';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { permitir } from '../banco.ts';
import { referencias } from '../integracao.ts';
import type { Aluno, Fontes } from '../integracao.ts';
import { calcularFrequencia } from './Presenca.ts';
import { ErroCadastro } from './Professores.ts';
import { podeAcessar, podeGerarRelatorio, relatoriosPorAluno } from '../permissoes.ts';

export const tiposRelatorio = {
  individual: 'Relatório individual do aluno',
  evolucao: 'Evolução pedagógica',
  frequencia: 'Frequência',
  aulas: 'Aulas realizadas',
  canceladas: 'Aulas canceladas',
  conteudos: 'Conteúdos trabalhados',
  avaliacoes: 'Avaliações e notas',
  financeiro: 'Relatório financeiro',
  pendentes: 'Pagamentos pendentes',
  faturamento: 'Faturamento mensal',
  horas: 'Horas trabalhadas',
  responsavel: 'Acompanhamento para o responsável',
};
export type Relatorio = {
  titulo: string;
  aluno: string;
  periodo: string;
  geradoEm: string;
  ficha: Array<{ rotulo: string; valor: string }>;
  colunas: string[];
  linhas: string[][];
  resumo: string[];
  avisos: string[];
};
export function gerarRelatorio(
  banco: Banco,
  usuario: Usuario,
  fontes: Fontes,
  params: URLSearchParams,
): Relatorio {
  const tipo = params.get('tipo') ?? 'individual';
  if (!Object.hasOwn(tiposRelatorio, tipo)) throw new ErroCadastro('Relatório inválido.');
  permitir(usuario, 'relatorios');
  if (!podeGerarRelatorio(usuario, tipo))
    throw new ErroCadastro('Você não tem permissão para os dados deste relatório.', 403);
  const inicio = params.get('inicio') ?? '';
  const fim = params.get('fim') ?? '';
  for (const valor of [inicio, fim])
    if (
      valor &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
        Number.isNaN(Date.parse(valor)) ||
        new Date(valor).toISOString().slice(0, 10) !== valor)
    )
      throw new ErroCadastro('Período inválido.');
  if (inicio && fim && inicio > fim)
    throw new ErroCadastro('A data inicial deve ser anterior à final.');
  const alunoId = params.get('alunoId') ?? '';
  if (relatoriosPorAluno.includes(tipo) && !alunoId)
    throw new ErroCadastro('Selecione um aluno para gerar este relatório.');
  const ref = referencias(fontes, usuario);
  const selecionadoAluno = alunoId ? ref.alunos.find((a) => a.id === alunoId) : undefined;
  if (alunoId && !selecionadoAluno) throw new ErroCadastro('Aluno não encontrado.');
  const aluno = (id: unknown) => ref.alunos.find((a) => a.id === id)?.nome ?? 'Aluno indisponível';
  const selecionado = (id: unknown) => !alunoId || id === alunoId;
  const periodo = (data: unknown) =>
    typeof data === 'string' &&
    (!inicio || data.slice(0, 10) >= inicio) &&
    (!fim || data.slice(0, 10) <= fim);
  const presencas = banco
    .listar('presencas', usuario)
    .map((r) => r.dados)
    .filter((d) => selecionado(d.alunoId) && periodo(d.data));
  const avaliacoes = banco
    .listar('avaliacoes', usuario)
    .map((r) => r.dados)
    .filter((d) => selecionado(d.alunoId) && periodo(d.data))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const aprendizados = banco
    .listar('aprendizados', usuario)
    .map((r) => r.dados)
    .filter((d) => selecionado(d.alunoId));
  const conteudos = banco.listar('conteudos', usuario);
  const aulas = ref.aulas
    .filter((a) => selecionado(a.alunoId) && periodo(a.data))
    .map((a) => ({
      ...a,
      conteudos: podeAcessar(usuario, 'planejamento') ? a.conteudos : '',
      status: podeAcessar(usuario, 'presenca')
        ? presencas.find((p) => p.aulaId === a.id)?.status ?? a.status
        : a.status,
    }));
  const realizadas = aulas.filter((a) =>
    ['Presente', 'Reposição realizada', 'Realizada'].includes(String(a.status)),
  );
  const rel: Relatorio = {
    titulo: tiposRelatorio[tipo as keyof typeof tiposRelatorio],
    aluno: selecionadoAluno?.nome ?? 'Todos os alunos com acesso',
    periodo: `${inicio || 'Início'} até ${fim || 'sem data final'}`,
    geradoEm: new Date().toISOString(),
    ficha: selecionadoAluno ? fichaAluno(banco, selecionadoAluno) : [],
    colunas: [],
    linhas: [],
    resumo: [],
    avisos: [],
  };
  if (!ref.alunos.length)
    rel.avisos.push('Nenhum aluno cadastrado para este acesso.');
  if (['individual', 'responsavel', 'avaliacoes'].includes(tipo)) {
    rel.colunas = [
      'Aluno',
      'Avaliação',
      'Data',
      'Nota',
      'Aproveitamento',
      'Dificuldades / reforço',
    ];
    rel.linhas = avaliacoes.map((a) => [
      aluno(a.alunoId),
      String(a.nome),
      String(a.data),
      `${a.nota} / ${a.notaMaxima}`,
      `${((Number(a.nota) / Number(a.notaMaxima)) * 100).toFixed(1)}%`,
      `${a.dificuldades || ''} ${a.reforcar || ''}`.trim(),
    ]);
    if (tipo !== 'avaliacoes') {
      for (const a of ref.alunos.filter((a) => selecionado(a.id))) {
        const f = calcularFrequencia(presencas.filter((p) => p.alunoId === a.id));
        const aprendizado = aprendizados.filter((p) => p.alunoId === a.id);
        rel.resumo.push(
          `${a.nome} — Frequência: ${f.percentual === null ? 'sem registros' : `${f.percentual}%`}; conteúdos dominados: ${aprendizado.filter((p) => p.status === 'Dominado').length} de ${aprendizado.length}`,
        );
        for (const p of aprendizado)
          rel.resumo.push(
            `${a.nome} — ${conteudos.find((c) => c.id === p.conteudoId)?.dados.nome ?? 'Conteúdo indisponível'}: ${p.status}${p.dificuldades ? `; dificuldades: ${p.dificuldades}` : ''}`,
          );
      }
      rel.avisos.push(
        'O aprendizado dos conteúdos mostra a situação atual. O período filtra as avaliações e a frequência.',
      );
    }
  } else if (tipo === 'evolucao') {
    rel.colunas = ['Aluno', 'Data', 'Avaliação', 'Aproveitamento', 'Média escolar', 'Dificuldades'];
    rel.linhas = avaliacoes.map((a) => [
      aluno(a.alunoId),
      String(a.data),
      String(a.nome),
      `${((Number(a.nota) / Number(a.notaMaxima)) * 100).toFixed(1)}%`,
      `${a.mediaEscolar} / ${a.notaMaxima}`,
      String(a.dificuldades),
    ]);
    rel.resumo.push(
      ...aprendizados.map(
        (a) =>
          `${aluno(a.alunoId)} — ${conteudos.find((c) => c.id === a.conteudoId)?.dados.nome ?? 'Conteúdo indisponível'}: ${a.status}`,
      ),
    );
    const largura = (a: typeof avaliacoes[number]) =>
      Math.round((Number(a.nota) / Number(a.notaMaxima)) * 10000) / 100;
    for (const a of ref.alunos.filter((a) => selecionado(a.id))) {
      const notas = avaliacoes.filter((item) => item.alunoId === a.id);
      if (!notas.length) continue;
      const primeira = largura(notas[0]);
      const ultima = largura(notas[notas.length - 1]);
      const tendencia = ultima > primeira ? 'progresso' : ultima < primeira ? 'queda' : 'estável';
      rel.resumo.push(
        `${a.nome} — ${notas.length} avaliação(ões); aproveitamento de ${primeira}% a ${ultima}% (${tendencia}).`,
      );
    }
    rel.avisos.push(
      'Notas em ordem cronológica. O resumo dos conteúdos mostra a situação atual, independentemente do período das avaliações.',
    );
  } else if (tipo === 'frequencia') {
    rel.colunas = ['Aluno', 'Data', 'Situação', 'Justificativa'];
    rel.linhas = presencas.map((p) => [
      aluno(p.alunoId),
      String(p.data),
      String(p.status),
      String(p.justificativa),
    ]);
    const resumirFrequencia = (registros: Dados[], rotulo = '') => {
      const f = calcularFrequencia(registros);
      const prefixo = rotulo ? `${rotulo} — ` : '';
      return [
        `${prefixo}Presenças: ${f.presentes}`,
        `${prefixo}Faltas: ${f.faltas}`,
        `${prefixo}Frequência: ${f.percentual === null ? 'sem registros' : `${f.percentual}%`}`,
      ];
    };
    if (selecionadoAluno) rel.resumo.push(...resumirFrequencia(presencas));
    else {
      for (const a of ref.alunos)
        rel.resumo.push(...resumirFrequencia(presencas.filter((p) => p.alunoId === a.id), a.nome));
      if (!ref.alunos.length) rel.resumo.push(...resumirFrequencia(presencas));
    }
    rel.avisos.push(
      'Cancelamentos, reagendamentos e faltas do professor não entram no cálculo. Faltas justificadas do aluno contam como falta.',
    );
  } else if (['aulas', 'canceladas', 'conteudos', 'horas'].includes(tipo)) {
    const linhas =
      tipo === 'canceladas'
        ? aulas.filter((a) => String(a.status).startsWith('Cancelad'))
        : realizadas;
    rel.colunas = ['Aluno', 'Data', 'Situação', 'Duração (min)', 'Conteúdos'];
    rel.linhas = linhas.map((a) => [
      aluno(a.alunoId),
      a.data,
      String(a.status),
      String(a.duracaoMinutos),
      a.conteudos,
    ]);
    rel.resumo.push(
      `Horas realizadas: ${(realizadas.reduce((s, a) => s + a.duracaoMinutos, 0) / 60).toFixed(2)}`,
    );
    if (!ref.aulas.length) rel.avisos.push('Nenhuma aula cadastrada para este acesso.');
  } else {
    let pagamentos = ref.pagamentos.filter(
      (p) =>
        selecionado(p.alunoId) && periodo(tipo === 'faturamento' ? p.recebidoEm : p.vencimento),
    );
    if (tipo === 'pendentes') pagamentos = pagamentos.filter((p) => p.status !== 'Recebido');
    if (tipo === 'faturamento') pagamentos = pagamentos.filter((p) => p.status === 'Recebido');
    const moeda = (valor: number) =>
      valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const somar = (filtro: (p: (typeof pagamentos)[number]) => boolean) =>
      Math.round(pagamentos.filter(filtro).reduce((s, p) => s + p.valor, 0) * 100) / 100;
    const recebidos = pagamentos.filter((p) => p.status === 'Recebido');
    const emAberto = pagamentos.filter((p) => p.status !== 'Recebido');
    const vencidos = pagamentos.filter((p) => p.status === 'Vencido');
    rel.colunas = ['Aluno', 'Lançamento', 'Vencimento', 'Recebimento', 'Situação', 'Valor'];
    rel.linhas = pagamentos.map((p) => [
      aluno(p.alunoId),
      p.nome,
      p.vencimento,
      p.recebidoEm ?? '',
      p.status,
      moeda(p.valor),
    ]);
    if (tipo === 'faturamento') {
      const meses = new Map<string, number>();
      for (const p of pagamentos) {
        const mes = p.recebidoEm!.slice(0, 7);
        meses.set(mes, (meses.get(mes) ?? 0) + p.valor);
      }
      rel.colunas = ['Mês', 'Total recebido'];
      rel.linhas = [...meses]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, total]) => [mes, moeda(total)]);
    }
    rel.resumo.push(
      `Lançamentos no período: ${pagamentos.length}`,
      `Recebido: ${moeda(somar((p) => p.status === 'Recebido'))} (${recebidos.length})`,
      `Em aberto: ${moeda(somar((p) => p.status !== 'Recebido'))} (${emAberto.length})`,
      `Vencido: ${moeda(somar((p) => p.status === 'Vencido'))} (${vencidos.length})`,
      `Total previsto: ${moeda(somar(() => true))}`,
      emAberto.length
        ? `Situação financeira: ${emAberto.length} lançamento(s) pendente(s) de ${pagamentos.length}.`
        : 'Situação financeira: sem pendências no período.',
    );
    if (!ref.pagamentos.length)
      rel.avisos.push('Nenhum pagamento cadastrado para este acesso.');
  }
  if (['individual', 'responsavel', 'evolucao'].includes(tipo)) {
    const evolucoes = banco
      .listar('acompanhamentos', usuario)
      .map((r) => r.dados)
      .filter((d) => selecionado(d.alunoId) && periodo(d.data))
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    rel.resumo.push(
      ...evolucoes.map(
        (d) =>
          `${aluno(d.alunoId)} — ${d.data}: ${d.evolucao}${d.retomar ? `; retomar: ${d.retomar}` : ''}`,
      ),
    );
  }
  if (!rel.linhas.length)
    rel.avisos.push('Nenhum registro encontrado para os filtros selecionados.');
  return rel;
}

function nomeDoProfessor(banco: Banco, professorId: string) {
  if (!professorId) return '';
  try {
    const linha = banco.db.prepare('SELECT cadastro FROM professores WHERE id=?').get(professorId);
    return linha ? String(JSON.parse(String(linha.cadastro)).nome ?? '') : '';
  } catch {
    return '';
  }
}

function fichaAluno(banco: Banco, aluno: Aluno) {
  const nomeProfessor = nomeDoProfessor(banco, aluno.professorId);
  const campos: Array<[string, unknown]> = [
    ['Aluno', aluno.nome],
    ['Situação', aluno.status],
    ['Idade', aluno.idade ? `${aluno.idade} anos` : ''],
    ['Série / ano', aluno.serie],
    ['Escola', aluno.escola],
    ['Modalidade', aluno.modalidade],
    ['Disciplina', aluno.disciplina],
    ['Objetivo', aluno.objetivo],
    [
      'Responsável',
      aluno.responsavel && aluno.parentesco
        ? `${aluno.responsavel} (${aluno.parentesco})`
        : aluno.responsavel,
    ],
    ['Contato do responsável', aluno.contatoResponsavel],
    ['E-mail do responsável', aluno.emailResponsavel],
    ['Professor responsável', nomeProfessor],
  ];
  return campos
    .filter(([, valor]) => String(valor ?? '').trim() !== '')
    .map(([rotulo, valor]) => ({ rotulo, valor: String(valor).trim() }));
}

const cinza = '#4f615d';
const escuro = '#293b37';
const verde = '#286b6e';
const borda = '#e6ebe9';

export async function gerarPdf(
  relatorio: Relatorio,
  opcoes: { instituicao?: string; contato?: string } = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 45,
    bufferPages: true,
    info: { Title: relatorio.titulo, Author: 'EduConnect', Subject: relatorio.aluno },
  });
  const partes: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  try {
    escreverRelatorio(doc, relatorio, opcoes);
    doc.end();
  } catch (erro) {
    doc.end();
    throw new ErroCadastro(
      `Não foi possível gerar o PDF do relatório${erro instanceof Error ? `: ${erro.message}` : '.'}`,
      500,
    );
  }
  return pronto;
}

function escreverRelatorio(
  doc: PDFKit.PDFDocument,
  relatorio: Relatorio,
  opcoes: { instituicao?: string; contato?: string },
) {
  const margem = doc.page.margins.left;
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const limite = () => doc.page.height - doc.page.margins.bottom - 25;

  function secao(titulo: string) {
    if (doc.y + 40 > limite()) doc.addPage();
    doc.moveDown(1);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(verde)
      .text(titulo.toUpperCase(), margem, doc.y, { width: largura, characterSpacing: 0.6 });
    doc.moveDown(0.35);
  }

  function paragrafo(texto: string, tamanho = 9, cor = escuro) {
    if (doc.y + 24 > limite()) doc.addPage();
    doc
      .font('Helvetica')
      .fontSize(tamanho)
      .fillColor(cor)
      .text(texto, margem, doc.y, { width: largura, lineGap: 1.5 });
    doc.moveDown(0.25);
  }

  function tabela(colunas: string[], linhas: string[][]) {
    const pesos = colunas.map((coluna, indice) => {
      const maior = Math.max(
        coluna.length,
        ...linhas.map((linha) => String(linha[indice] ?? '').length),
        5,
      );
      return Math.min(Math.max(maior, 6), 42);
    });
    const total = pesos.reduce((soma, peso) => soma + peso, 0);
    const minimo = Math.min(60, largura / colunas.length);
    const proporcoes = pesos.map((peso) => Math.max(minimo, (peso / total) * largura));
    const somaProporcoes = proporcoes.reduce((soma, valor) => soma + valor, 0);
    const colunasLarguras = proporcoes.map((valor) => (valor * largura) / somaProporcoes);

    const cabecalho = () => {
      if (doc.y + 26 > limite()) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(7.5);
      const alturas = colunas.map((coluna, indice) =>
        doc.heightOfString(coluna.toUpperCase(), { width: colunasLarguras[indice] - 8 }),
      );
      const altura = Math.max(...alturas, 11) + 9;
      const y = doc.y;
      doc.rect(margem, y, largura, altura).fill('#f1f4f3');
      doc.fillColor(cinza);
      let x = margem;
      colunas.forEach((coluna, indice) => {
        doc.text(coluna.toUpperCase(), x + 4, y + 4, { width: colunasLarguras[indice] - 8 });
        x += colunasLarguras[indice];
      });
      doc.y = y + altura;
    };

    const linha = (valores: string[], fundo?: string) => {
      doc.font('Helvetica').fontSize(8.5);
      const alturas = colunas.map((_, indice) =>
        doc.heightOfString(valores[indice] || ' ', { width: colunasLarguras[indice] - 8 }),
      );
      const altura = Math.max(...alturas, 11) + 8;
      if (doc.y + altura > limite()) {
        doc.addPage();
        cabecalho();
      }
      const y = doc.y;
      if (fundo) doc.rect(margem, y, largura, altura).fill(fundo);
      doc.fillColor(escuro);
      let x = margem;
      valores.forEach((valor, indice) => {
        doc.text(String(valor ?? ''), x + 4, y + 4, { width: colunasLarguras[indice] - 8 });
        x += colunasLarguras[indice];
      });
      doc
        .moveTo(margem, y + altura)
        .lineTo(margem + largura, y + altura)
        .strokeColor(borda)
        .stroke();
      doc.y = y + altura;
    };

    cabecalho();
    linhas.forEach((valores, indice) => linha(valores, indice % 2 ? '#fafbfa' : undefined));
  }

  const instituicao = (opcoes.instituicao ?? '').trim();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(verde).text(instituicao || 'EduConnect', margem, doc.y, { width: largura });
  if (opcoes.contato?.trim())
    doc.font('Helvetica').fontSize(8.5).fillColor(cinza).text(opcoes.contato.trim(), { width: largura });
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(escuro).text(relatorio.titulo, margem, doc.y, {
    width: largura,
  });
  doc.moveDown(0.35);
  doc.font('Helvetica').fontSize(9).fillColor(cinza);
  doc.text(`Aluno: ${relatorio.aluno}`, margem, doc.y, { width: largura });
  doc.text(`Período: ${relatorio.periodo}`, margem, doc.y, { width: largura });
  doc.text(
    `Gerado em ${new Date(relatorio.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    margem,
    doc.y,
    { width: largura },
  );
  const separador = doc.y + 6;
  doc
    .moveTo(margem, separador)
    .lineTo(margem + largura, separador)
    .strokeColor('#d9e0de')
    .stroke();
  doc.y = separador + 4;

  if (relatorio.ficha.length) {
    secao('Dados do aluno');
    tabela(
      ['Campo', 'Informação'],
      relatorio.ficha.map((campo) => [campo.rotulo, campo.valor]),
    );
  }
  if (relatorio.resumo.length) {
    secao('Resumo');
    for (const item of relatorio.resumo) paragrafo(`•  ${item}`);
  }
  if (relatorio.avisos.length) {
    secao('Observações');
    for (const item of relatorio.avisos) paragrafo(item, 8.5, cinza);
  }
  secao('Registros');
  if (!relatorio.linhas.length) paragrafo('Nenhum registro para os filtros selecionados.', 9, cinza);
  else tabela(relatorio.colunas, relatorio.linhas);

  const paginas = doc.bufferedPageRange();
  for (let indice = paginas.start; indice < paginas.start + paginas.count; indice += 1) {
    doc.switchToPage(indice);
    const margemInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor('#7a8784');
    doc.text(
      `EduConnect • ${relatorio.titulo} • Página ${indice - paginas.start + 1} de ${paginas.count}`,
      margem,
      doc.page.height - 32,
      { width: largura, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = margemInferior;
  }
}
