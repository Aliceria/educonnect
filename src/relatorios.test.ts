import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { fontesDoBanco } from './integracao.ts';
import { gerarPdf, gerarRelatorio } from './modulos/Relatorios.ts';
import { abrirProfessores } from './modulos/Professores.ts';

const admin: Usuario = {
  id: 'admin',
  nome: 'Admin',
  email: '',
  perfil: 'Administrador',
  professorId: '',
  permissoes: [],
  ativo: true,
};

function cenario() {
  const banco = abrirBanco(':memory:');
  const professores = abrirProfessores(banco.db);
  const professor = professores.criar({
    nome: 'Professor Um',
    contato: '11987654321',
    email: 'professor@example.test',
    disciplinas: ['Matemática'],
    valorHora: 100,
    modalidade: 'Presencial',
    horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }],
    endereco: 'Rua A',
    recebimento: 'Pix',
    perfil: 'Professor',
    ativo: true,
  });
  const docente: Usuario = {
    id: 'docente',
    nome: 'Professor Um',
    email: 'professor@example.test',
    perfil: 'Professor',
    professorId: professor.id,
    permissoes: ['relatorios', 'alunos', 'presenca', 'avaliacoes', 'acompanhamento', 'disciplinas', 'pagamentos', 'financeiro'],
    ativo: true,
  };
  const aluno = banco.salvar(
    'alunos',
    {
      nome: 'Ana Souza',
      idade: 12,
      professorId: professor.id,
      responsavel: 'Maria Souza',
      parentesco: 'Mãe',
      contatoResponsavel: '11912345678',
      emailResponsavel: 'maria@example.test',
      serie: '7º ano',
      escola: 'Escola Central',
      modalidade: 'Presencial',
      disciplina: 'Matemática',
      objetivo: 'Reforço de frações',
      status: 'Ativo',
    },
    admin,
  );
  const outro = banco.salvar(
    'alunos',
    { nome: 'Bruno Lima', idade: 15, professorId: professor.id, status: 'Ativo' },
    admin,
  );
  const presenca = (alunoId: string, data: string, status: string) =>
    banco.salvar(
      'presencas',
      {
        alunoId,
        professorId: professor.id,
        data,
        status,
        justificativa: '',
        aulaId: `aula-${alunoId}-${data}`,
      },
      admin,
    );
  presenca(aluno.id, '2026-01-06', 'Presente');
  presenca(aluno.id, '2026-01-13', 'Falta');
  presenca(aluno.id, '2026-01-20', 'Falta justificada');
  presenca(aluno.id, '2026-02-03', 'Presente');
  presenca(outro.id, '2026-01-06', 'Presente');
  banco.salvar(
    'avaliacoes',
    {
      nome: 'Prova de frações',
      alunoId: aluno.id,
      professorId: professor.id,
      data: '2026-01-15',
      nota: 6,
      notaMaxima: 10,
      mediaEscolar: 7,
      dificuldades: 'Divisão',
      reforcar: 'Exercícios',
    },
    admin,
  );
  banco.salvar(
    'avaliacoes',
    {
      nome: 'Prova de porcentagem',
      alunoId: aluno.id,
      professorId: professor.id,
      data: '2026-02-15',
      nota: 9,
      notaMaxima: 10,
      mediaEscolar: 8,
      dificuldades: '',
      reforcar: '',
    },
    admin,
  );
  banco.salvar(
    'acompanhamentos',      { alunoId: aluno.id, professorId: professor.id, data: '2026-01-20', evolucao: 'Ganhou autonomia', retomar: '' },
    admin,
  );
  const pagamento = (nome: string, vencimento: string, recebidoEm: string, valor: number) =>
    banco.salvar(
      'pagamentos',
      {
        nome,
        alunoId: aluno.id,
        professorId: professor.id,
        pacoteId: '',
        valor,
        vencimento,
        recebidoEm,
        status: recebidoEm ? 'Recebido' : 'Pendente',
        forma: 'Pix',
      },
      admin,
    );
  pagamento('Janeiro', '2026-01-10', '2026-01-08', 100);
  pagamento('Fevereiro', '2026-01-10', '', 150);
  pagamento('Março', '2099-12-10', '', 200);

  const fontes = fontesDoBanco(banco);
  const gerar = (tipo: string, extra: Record<string, string> = {}, usuario = docente) =>
    gerarRelatorio(banco, usuario, fontes, new URLSearchParams({ tipo, ...extra }));
  return { banco, gerar, aluno, outro };
}

test('relatório individual exige aluno e traz os dados gerais do selecionado', () => {
  const { banco, gerar, aluno, outro } = cenario();
  try {
    assert.throws(() => gerar('individual'), /Selecione um aluno/);
    assert.throws(() => gerar('responsavel'), /Selecione um aluno/);
    assert.throws(() => gerar('individual', { alunoId: 'inexistente' }), /Aluno não encontrado/);

    const relatorio = gerar('individual', { alunoId: aluno.id });
    assert.equal(relatorio.aluno, 'Ana Souza');
    assert.deepEqual(
      relatorio.ficha.map((campo) => campo.rotulo),
      [
        'Aluno',
        'Situação',
        'Idade',
        'Série / ano',
        'Escola',
        'Modalidade',
        'Disciplina',
        'Objetivo',
        'Responsável',
        'Contato do responsável',
        'E-mail do responsável',
        'Professor responsável',
      ],
    );
    assert.equal(relatorio.ficha[0].valor, 'Ana Souza');
    assert.match(relatorio.ficha.find((c) => c.rotulo === 'Responsável')!.valor, /Maria Souza \(Mãe\)/);
    assert.match(relatorio.ficha.find((c) => c.rotulo === 'Professor responsável')!.valor, /Professor Um/);
    assert.equal(relatorio.linhas.length, 2);
    assert.ok(relatorio.linhas.every((linha) => linha[0] === 'Ana Souza'));
    assert.ok(relatorio.resumo.some((linha) => linha.includes('Frequência: 50%')));
    assert.ok(relatorio.resumo.some((linha) => linha.includes('Ganhou autonomia')));
    assert.ok(!JSON.stringify(relatorio).includes('Bruno Lima'));

    const doOutro = gerar('individual', { alunoId: outro.id });
    assert.equal(doOutro.aluno, 'Bruno Lima');
    assert.deepEqual(doOutro.linhas, []);
    assert.ok(doOutro.avisos.some((aviso) => aviso.includes('Nenhum registro')));
  } finally {
    banco.fechar();
  }
});

test('relatório de frequência e de avaliações respeitam aluno e período', () => {
  const { banco, gerar, aluno } = cenario();
  try {
    const frequencia = gerar('frequencia', { alunoId: aluno.id });
    assert.equal(frequencia.linhas.length, 4);
    assert.deepEqual(frequencia.resumo.slice(0, 3), [
      'Presenças: 2',
      'Faltas: 2',
      'Frequência: 50%',
    ]);

    const janeiro = gerar('frequencia', { alunoId: aluno.id, inicio: '2026-01-01', fim: '2026-01-31' });
    assert.equal(janeiro.linhas.length, 3);
    assert.deepEqual(janeiro.resumo.slice(0, 3), [
      'Presenças: 1',
      'Faltas: 2',
      'Frequência: 33.33%',
    ]);
    assert.ok(janeiro.linhas.every((linha) => linha[0] === 'Ana Souza'));

    const todos = gerar('frequencia');
    assert.ok(todos.resumo.includes('Ana Souza — Frequência: 50%'));
    assert.ok(todos.resumo.includes('Bruno Lima — Presenças: 1'));
    assert.ok(!todos.resumo.some((linha) => /^Frequência:/.test(linha)));

    const avaliacoes = gerar('avaliacoes', { alunoId: aluno.id, inicio: '2026-02-01' });
    assert.equal(avaliacoes.linhas.length, 1);
    assert.match(avaliacoes.linhas[0][1], /porcentagem/);
    assert.equal(avaliacoes.ficha[0].valor, 'Ana Souza');

    const evolucao = gerar('evolucao', { alunoId: aluno.id });
    assert.deepEqual(evolucao.linhas.map((linha) => linha[1]), ['2026-01-15', '2026-02-15']);
    assert.ok(evolucao.resumo.some((linha) => linha.includes('60% a 90% (progresso)')));
    assert.throws(
      () => gerar('frequencia', { inicio: '2026-12-31', fim: '2026-01-01' }),
      /data inicial deve ser anterior/,
    );
    assert.throws(() => gerar('frequencia', { inicio: '2026-02-30' }), /Período inválido/);
  } finally {
    banco.fechar();
  }
});

test('relatório financeiro consolida recebido, em aberto e vencido', () => {
  const { banco, gerar, aluno } = cenario();
  try {
    const financeiro = gerar('financeiro', { alunoId: aluno.id });
    assert.equal(financeiro.linhas.length, 3);
    assert.deepEqual(
      financeiro.linhas.map((linha) => linha[4]).sort(),
      ['Pendente', 'Recebido', 'Vencido'],
    );
    assert.deepEqual(
      financeiro.linhas.map((linha) => linha[1]),
      ['Janeiro', 'Fevereiro', 'Março'],
    );
    const resumo = financeiro.resumo.join('\n');
    assert.match(resumo, /Lançamentos no período: 3/);
    assert.match(resumo, /Recebido: R\$\s100,00 \(1\)/);
    assert.match(resumo, /Em aberto: R\$\s350,00 \(2\)/);
    assert.match(resumo, /Vencido: R\$\s150,00 \(1\)/);
    assert.match(resumo, /Total previsto: R\$\s450,00/);
    assert.match(resumo, /2 lançamento\(s\) pendente\(s\) de 3/);

    const pendentes = gerar('pendentes');
    assert.equal(pendentes.linhas.length, 2);

    const janeiro = gerar('faturamento', { inicio: '2026-01-01', fim: '2026-01-31' });
    assert.deepEqual(janeiro.colunas, ['Mês', 'Total recebido']);
    assert.equal(janeiro.linhas.length, 1);
    assert.equal(janeiro.linhas[0][0], '2026-01');
    assert.match(janeiro.linhas[0][1], /R\$\s?100,00/);
  } finally {
    banco.fechar();
  }
});

test('relatórios respeitam as permissões e geram PDF válido', async () => {
  const { banco, gerar, aluno } = cenario();
  try {
    const semFinanceiro: Usuario = {
      ...admin,
      id: 'docente',
      perfil: 'Professor',
      permissoes: ['relatorios', 'alunos', 'presenca', 'avaliacoes', 'acompanhamento', 'disciplinas'],
      professorId: aluno.dados.professorId as string,
    };
    assert.throws(() => gerar('financeiro', {}, semFinanceiro), /permissão/);
    assert.throws(
      () => gerar('individual', { alunoId: aluno.id }, { ...semFinanceiro, permissoes: [] }),
      /permissão/,
    );

    const relatorio = gerar('individual', { alunoId: aluno.id });
    const pdf = await gerarPdf(relatorio, { instituicao: 'Escola Central', contato: 'contato@escola.test' });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.byteLength > 1000);
    assert.match(pdf.subarray(-64).toString(), /%%EOF/);

    const vazio = await gerarPdf({ ...relatorio, ficha: [], resumo: [], avisos: [], linhas: [], colunas: [] });
    assert.equal(vazio.subarray(0, 5).toString(), '%PDF-');
  } finally {
    banco.fechar();
  }
});
