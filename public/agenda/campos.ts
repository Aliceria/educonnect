import type { Campo } from '../Cadastro';

export const camposAgenda: Campo[] = [
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'data', rotulo: 'Data', tipo: 'data' },
          { nome: 'hora', rotulo: 'Horário de início', tipo: 'hora' },
          {
            nome: 'duracaoMinutos',
            rotulo: 'Duração (minutos)',
            tipo: 'numero',
            minimo: 15,
            maximo: 480,
            passo: 1,
            inicial: 60,
          },
          {
            nome: 'status',
            rotulo: 'Situação',
            opcoes: [
              'Agendada',
              'Reposição',
              'Realizada',
              'Falta',
              'Falta justificada',
              'Falta do professor',
              'Cancelada pelo aluno',
              'Cancelada pelo professor',
              'Reagendada',
              'Reposição realizada',
            ],
          },
          {
            nome: 'justificativa',
            rotulo: 'Justificativa da falta',
            tipo: 'area',
            opcional: true,
          },
          {
            nome: 'pacoteId',
            rotulo: 'Pacote (opcional)',
            fonte: 'pacotes',
            opcional: true,
          },
          {
            nome: 'originalId',
            rotulo: 'Aula original da reposição',
            fonte: 'aulas',
            opcional: true,
          },
          {
            nome: 'link',
            rotulo: 'Link da videochamada (opcional)',
            opcional: true,
          },
          {
            nome: 'conteudos',
            rotulo: 'Conteúdo da aula',
            tipo: 'area',
            opcional: true,
          },
                  { nome: 'modalidade', rotulo: 'Modalidade', opcoes: ['Presencial', 'On-line'] },
          { nome: 'disciplina', rotulo: 'Disciplina (padrão do aluno quando vazia)', opcional: true },
          { nome: 'observacoes', rotulo: 'Observações', tipo: 'area', opcional: true },
];
