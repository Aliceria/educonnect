import { texto, numero, data, escolha } from '../banco.ts';
import type { Banco, Dados, Usuario } from '../banco.ts';
import { alunoDoUsuario } from './Alunos.ts';
import { ErroCadastro } from './Professores.ts';

export const estadosAula = [
  'Agendada',
  'Realizada',
  'Falta',
  'Falta justificada',
  'Falta do professor',
  'Cancelada pelo aluno',
  'Cancelada pelo professor',
  'Reagendada',
  'Reposição realizada',
];
export function validarAula(d: Dados, banco: Banco, usuario: Usuario, id?: string) {
  const alunoId = texto(d, 'alunoId');
  const aluno = alunoDoUsuario(banco, usuario, alunoId, !id);
  const professorId = String(aluno.dados.professorId);
  const dia = data(d, 'data');
  const hora = texto(d, 'hora');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErroCadastro('Horário inválido.');
  const duracaoMinutos = numero(d, 'duracaoMinutos', 15, 480);
  const inicio = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
  if (!Number.isInteger(duracaoMinutos) || inicio + duracaoMinutos > 1440)
    throw new ErroCadastro('Confira a duração da aula.');
  const status = escolha(d, 'status', estadosAula);
  const justificativa = texto(
    { ...d, justificativa: d.justificativa ?? '' },
    'justificativa',
    status === 'Falta justificada',
  );
  const anteriores = banco.db
    .prepare("SELECT id,dados FROM registros WHERE tipo='aulas'")
    .all()
    .map((r) => ({ id: String(r.id), dados: JSON.parse(String(r.dados)) }));
  const anterior = id ? banco.buscar('aulas', id, usuario) : undefined;
  if (
    anterior &&
    (anterior.dados.alunoId !== alunoId ||
      anterior.dados.data !== dia ||
      anterior.dados.hora !== hora)
  )
    throw new ErroCadastro(
      'Para mudar a data ou o horário, use Reagendar. O aluno da aula não pode ser trocado.',
    );
  const ocupa =
    !status.startsWith('Cancelada') && status !== 'Reagendada' && status !== 'Falta do professor';
  if (
    ocupa &&
    anteriores.some((a) => {
      if (
        a.id === id ||
        a.dados.professorId !== professorId ||
        a.dados.data !== dia ||
        String(a.dados.status).startsWith('Cancelada') ||
        ['Reagendada', 'Falta do professor'].includes(a.dados.status)
      )
        return false;
      const i = Number(a.dados.hora.slice(0, 2)) * 60 + Number(a.dados.hora.slice(3));
      return inicio < i + Number(a.dados.duracaoMinutos) && i < inicio + duracaoMinutos;
    })
  )
    throw new ErroCadastro('O professor já tem uma aula nesse horário.', 409);
  if (status === 'Reagendada' && anterior?.dados.status !== 'Reagendada')
    throw new ErroCadastro(
      'Use a ação Reagendar para manter a aula original e criar o novo horário.',
    );
  if (anterior && texto(d, 'originalId', false) !== (anterior.dados.originalId ?? ''))
    throw new ErroCadastro('O vínculo com a aula original não pode ser alterado.');
  if (
    anterior &&
    anteriores.some((a) => a.dados.originalId === id) &&
    (ocupa || d.pacoteId !== anterior.dados.pacoteId)
  )
    throw new ErroCadastro(
      'Esta aula já tem uma reposição ou reagendamento. Ajuste a aula vinculada.',
    );
  const mudouHorario =
    !anterior ||
    anterior.dados.duracaoMinutos !== duracaoMinutos ||
    String(anterior.dados.status).startsWith('Cancelada') ||
    ['Reagendada', 'Falta do professor'].includes(String(anterior.dados.status));
  const hoje = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  if (
    !['Agendada', 'Reagendada', 'Cancelada pelo aluno', 'Cancelada pelo professor'].includes(
      status,
    ) &&
    dia > hoje
  )
    throw new ErroCadastro('A aula ainda não aconteceu.');
  const originalId = texto(d, 'originalId', false);
  if (originalId) {
    const original = banco.buscar('aulas', originalId, usuario);
    if (
      original.id === id ||
      original.dados.alunoId !== alunoId ||
      ![
        'Reagendada',
        'Cancelada pelo aluno',
        'Cancelada pelo professor',
        'Falta do professor',
      ].includes(String(original.dados.status))
    )
      throw new ErroCadastro('Aula original inválida para reposição.');
    if (
      anteriores.some(
        (a) =>
          a.id !== id &&
          a.dados.originalId === originalId &&
          !String(a.dados.status).startsWith('Cancelada') &&
          a.dados.status !== 'Reagendada',
      )
    )
      throw new ErroCadastro('Já existe reposição para essa aula.', 409);
  }
  if (status === 'Reposição realizada' && !originalId)
    throw new ErroCadastro('Informe a aula original.');
  const pacoteId = texto(d, 'pacoteId', false);
  if (originalId && banco.buscar('aulas', originalId, usuario).dados.pacoteId !== pacoteId)
    throw new ErroCadastro('A reposição deve manter o pacote da aula original.');
  if (pacoteId && banco.buscar('pacotes', pacoteId, usuario).dados.alunoId !== alunoId)
    throw new ErroCadastro('Pacote de outro aluno.');
  const link = texto({ ...d, link: d.link ?? '' }, 'link', false);
  if (link) {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error();
    } catch {
      throw new ErroCadastro('Link de videochamada inválido. Use HTTP ou HTTPS sem credenciais.');
    }
  }
  return {
    justificativa,
    nome: `${dia} ${hora} — ${aluno.dados.nome}`,
    alunoId,
    professorId,
    data: dia,
    hora,
    duracaoMinutos,
    status,
    pacoteId,
    originalId,
    link,
    conteudos: texto(d, 'conteudos', false),
  };
}

export function reagendar(banco: Banco, usuario: Usuario, id: string, d: Dados) {
  const original = banco.buscar('aulas', id, usuario);
  if (original.dados.status !== 'Agendada')
    throw new ErroCadastro('Só uma aula agendada pode ser reagendada.');
  banco.salvar('aulas', { ...original.dados, status: 'Reagendada' }, usuario, id, Number(d.versao));
  const nova = {
    ...original.dados,
    data: texto(d, 'data'),
    hora: texto(d, 'hora'),
    status: 'Agendada',
    originalId: id,
  };
  return banco.salvar('aulas', validarAula(nova, banco, usuario), usuario);
}

export function repetirAula(banco: Banco, usuario: Usuario, id: string, d: Dados) {
  const original = banco.buscar('aulas', id, usuario);
  if (original.dados.status !== 'Agendada') throw new ErroCadastro('Selecione uma aula agendada.');
  const quantidade = numero(d, 'quantidade', 1, 52);
  if (!Number.isInteger(quantidade)) throw new ErroCadastro('Informe uma quantidade inteira.');
  const novas = [];
  for (let semana = 1; semana <= quantidade; semana++) {
    const dia = new Date(String(original.dados.data) + 'T12:00:00Z');
    dia.setUTCDate(dia.getUTCDate() + semana * 7);
    novas.push(
      banco.salvar(
        'aulas',
        validarAula(
          {
            ...original.dados,
            data: dia.toISOString().slice(0, 10),
            originalId: '',
          },
          banco,
          usuario,
        ),
        usuario,
      ),
    );
  }
  return novas;
}
