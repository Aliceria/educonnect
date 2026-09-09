import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export type Horario = { dia: number; inicio: string; fim: string };

export type CadastroProfessor = {
  nome: string;
  contato: string;
  email: string;
  disciplinas: string[];
  valorHora: number;
  modalidade: 'Presencial' | 'On-line' | 'Presencial e on-line';
  horarios: Horario[];
  endereco: string;
  recebimento: string;
  perfil: 'Professor' | 'Administrador';
  ativo: boolean;
};

export type Professor = CadastroProfessor & { id: string; versao: number };

export class ErroCadastro extends Error {
  status: number;
  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ErroCadastro('Cadastro inválido.');
  }
  return valor as Record<string, unknown>;
}

export function validarVersao(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 1) {
    throw new ErroCadastro('Versão do cadastro inválida. Atualize a lista.');
  }
  return valor;
}

export function validarProfessor(valor: unknown): CadastroProfessor {
  const dados = objeto(valor);
  function texto(campo: string, rotulo: string, obrigatorio = false, limite = 500) {
    if (typeof dados[campo] !== 'string') throw new ErroCadastro(`Informe ${rotulo}.`);
    const conteudo = dados[campo].trim();
    if (obrigatorio && !conteudo) throw new ErroCadastro(`Informe ${rotulo}.`);
    if (conteudo.length > limite)
      throw new ErroCadastro(`${rotulo}: máximo de ${limite} caracteres.`);
    return conteudo;
  }
  const nome = texto('nome', 'o nome', true, 150);
  const contato = texto('contato', 'o contato', true, 100);
  const email = texto('email', 'o e-mail', true, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ErroCadastro('Informe um e-mail válido.');

  if (
    !Array.isArray(dados.disciplinas) ||
    !dados.disciplinas.length ||
    dados.disciplinas.length > 30
  ) {
    throw new ErroCadastro('Informe de 1 a 30 disciplinas.');
  }
  const disciplinas = dados.disciplinas
    .map((disciplina: unknown) => {
      if (typeof disciplina !== 'string' || !disciplina.trim() || disciplina.trim().length > 100) {
        throw new ErroCadastro('Cada disciplina precisa ter de 1 a 100 caracteres.');
      }
      return disciplina.trim();
    })
    .filter(
      (disciplina, indice, lista) =>
        lista.findIndex((item) => item.toLowerCase() === disciplina.toLowerCase()) === indice,
    );

  const valorHora = dados.valorHora;
  if (
    typeof valorHora !== 'number' ||
    !Number.isFinite(valorHora) ||
    valorHora < 0 ||
    valorHora > 1000000 ||
    Math.abs(valorHora * 100 - Math.round(valorHora * 100)) > 0.000001
  ) {
    throw new ErroCadastro('Informe um valor de hora-aula válido, com até duas casas decimais.');
  }
  if (
    typeof dados.modalidade !== 'string' ||
    !['Presencial', 'On-line', 'Presencial e on-line'].includes(dados.modalidade)
  ) {
    throw new ErroCadastro('Selecione uma modalidade válida.');
  }
  if (typeof dados.perfil !== 'string' || !['Professor', 'Administrador'].includes(dados.perfil)) {
    throw new ErroCadastro('Selecione um perfil válido.');
  }
  if (typeof dados.ativo !== 'boolean') throw new ErroCadastro('Status inválido.');
  if (!Array.isArray(dados.horarios) || !dados.horarios.length || dados.horarios.length > 50) {
    throw new ErroCadastro('Informe de 1 a 50 horários de atendimento.');
  }
  const horarios: Horario[] = dados.horarios.map((entrada: unknown) => {
    const horario = objeto(entrada);
    const horaValida = (hora: unknown): hora is string =>
      typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
    if (
      typeof horario.dia !== 'number' ||
      !Number.isInteger(horario.dia) ||
      horario.dia < 0 ||
      horario.dia > 6 ||
      !horaValida(horario.inicio) ||
      !horaValida(horario.fim) ||
      horario.inicio >= horario.fim
    ) {
      throw new ErroCadastro(
        'Confira os horários: o início precisa ser anterior ao fim, no mesmo dia.',
      );
    }
    return { dia: horario.dia, inicio: horario.inicio, fim: horario.fim };
  });
  horarios.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < horarios.length; i++) {
    if (horarios[i].dia === horarios[i - 1].dia && horarios[i].inicio < horarios[i - 1].fim) {
      throw new ErroCadastro('Existem horários sobrepostos no mesmo dia.');
    }
  }
  return {
    nome,
    contato,
    email,
    disciplinas,
    valorHora,
    horarios,
    modalidade: dados.modalidade as CadastroProfessor['modalidade'],
    endereco: texto('endereco', 'o endereço'),
    recebimento: texto('recebimento', 'os dados para recebimento'),
    perfil: dados.perfil as CadastroProfessor['perfil'],
    ativo: dados.ativo,
  };
}

// A tela importa apenas os tipos deste arquivo. Estas funções rodam no Node.js.
export function abrirProfessores(banco: DatabaseSync) {
  banco.exec(`CREATE TABLE IF NOT EXISTS professores (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    cadastro TEXT NOT NULL,
    versao INTEGER NOT NULL DEFAULT 1
  )`);
  function converter(linha: Record<string, unknown>): Professor {
    return {
      ...JSON.parse(String(linha.cadastro)),
      id: String(linha.id),
      versao: Number(linha.versao),
    };
  }
  function buscar(id: string): Professor {
    const linha = banco.prepare('SELECT * FROM professores WHERE id = ?').get(id);
    if (!linha) throw new ErroCadastro('Professor não encontrado.', 404);
    return converter(linha);
  }
  function conferirEmail(email: string, id?: string) {
    const existente = banco.prepare('SELECT id FROM professores WHERE email = ?').get(email);
    if (existente && existente.id !== id)
      throw new ErroCadastro('Já existe um professor com esse e-mail.', 409);
  }
  return {
    listar(): Professor[] {
      return banco.prepare('SELECT * FROM professores ORDER BY rowid DESC').all().map(converter);
    },
    buscar,
    criar(entrada: unknown): Professor {
      const cadastro = validarProfessor(entrada);
      conferirEmail(cadastro.email);
      const id = randomUUID();
      banco
        .prepare('INSERT INTO professores (id, email, cadastro) VALUES (?, ?, ?)')
        .run(id, cadastro.email, JSON.stringify(cadastro));
      return buscar(id);
    },
    editar(id: string, entrada: unknown): Professor {
      const dados = objeto(entrada);
      const versao = validarVersao(dados.versao);
      const cadastro = validarProfessor(dados);
      buscar(id);
      conferirEmail(cadastro.email, id);
      const resultado = banco
        .prepare(
          'UPDATE professores SET email = ?, cadastro = ?, versao = versao + 1 WHERE id = ? AND versao = ?',
        )
        .run(cadastro.email, JSON.stringify(cadastro), id, versao);
      if (!resultado.changes)
        throw new ErroCadastro(
          'Esse cadastro foi alterado em outra janela. Atualize a lista antes de editar novamente.',
          409,
        );
      return buscar(id);
    },
    alterarStatus(id: string, entrada: unknown): Professor {
      const dados = objeto(entrada);
      const versao = validarVersao(dados.versao);
      if (typeof dados.ativo !== 'boolean') throw new ErroCadastro('Status inválido.');
      const professor = buscar(id);
      return this.editar(id, { ...professor, ativo: dados.ativo, versao });
    },
  };
}
