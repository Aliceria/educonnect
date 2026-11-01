import { useState } from 'react';
import Cadastro from './Cadastro';
import type { Campo } from './Cadastro';
import FichaAluno from './FichaAluno';
import { series } from '../src/serie';

const campos: Campo[] = [
  { nome: 'nome', rotulo: 'Nome completo', nomePessoa: true },
  { nome: 'idade', rotulo: 'Idade', tipo: 'numero', minimo: 1 },
  { nome: 'professorId', rotulo: 'Professor responsável', fonte: 'professores' },
  { nome: 'telefone', rotulo: 'Telefone', tipo: 'telefone', opcional: true },
  { nome: 'email', rotulo: 'E-mail', opcional: true },
  { nome: 'escola', rotulo: 'Escola', opcional: true },
  { nome: 'serie', rotulo: 'Série / ano', opcoes: series, inicial: '', opcional: true },
  { nome: 'disciplina', rotulo: 'Disciplinas / áreas de estudo' },
  {
    nome: 'responsavel',
    rotulo: 'Responsável legal (obrigatório para menor)',
    nomePessoa: true,
    opcional: true,
  },
  { nome: 'contatoResponsavel', rotulo: 'Telefone do responsável', tipo: 'telefone', opcional: true },
  { nome: 'emailResponsavel', rotulo: 'E-mail do responsável', opcional: true },
  { nome: 'parentesco', rotulo: 'Parentesco', opcional: true },
  {
    nome: 'autorizacao',
    rotulo: 'Registro da autorização, quando aplicável',
    tipo: 'area',
    opcional: true,
  },
  { nome: 'dificuldade', rotulo: 'Dificuldades nos conteúdos', tipo: 'area', opcional: true },
  {
    nome: 'objetivo',
    rotulo: 'Objetivo',
    opcoes: ['Reforço', 'Recuperação', 'Prova', 'ENEM', 'Vestibular', 'Acompanhamento escolar'],
  },
  { nome: 'modalidade', rotulo: 'Modalidade', opcoes: ['Presencial', 'On-line', 'Híbrida'] },
  { nome: 'endereco', rotulo: 'Endereço', opcional: true },
  { nome: 'disponibilidade', rotulo: 'Dias e horários disponíveis', tipo: 'area', opcional: true },
  { nome: 'observacoes', rotulo: 'Observações pedagógicas', tipo: 'area', opcional: true },
  { nome: 'status', rotulo: 'Situação', opcoes: ['Ativo', 'Inativo'] },
];

export default function Alunos() {
  const [fichaAlunoId, setFichaAlunoId] = useState('');

  return (
    <>
      <h2>Alunos</h2>
      <Cadastro
        titulo="Cadastro de alunos"
        tipo="alunos"
        campos={campos}
        aviso="Informações sobre saúde ou adaptações ficam em Necessidades educacionais, na tela Acompanhamento."
        acoes={(registro) => (
          <button type="button" onClick={() => setFichaAlunoId(registro.id)}>
            Ver ficha
          </button>
        )}
      />
      {fichaAlunoId && (
        <FichaAluno
          key={fichaAlunoId}
          alunoId={fichaAlunoId}
          onFechar={() => setFichaAlunoId('')}
        />
      )}
    </>
  );
}
