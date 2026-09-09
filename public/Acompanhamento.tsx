import Cadastro from './Cadastro';

export default function Acompanhamento() {
  return (
    <>
      <h2>Acompanhamento pedagógico</h2>

      <Cadastro
        titulo="Evolução por aula"
        tipo="acompanhamentos"
        campos={[
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'aulaId', rotulo: 'Aula', fonte: 'aulas', opcional: true },
          { nome: 'data', rotulo: 'Data', tipo: 'data' },
          { nome: 'tipo', rotulo: 'Tipo de registro', opcoes: ['Evolução', 'Diagnóstico inicial'] },
          { nome: 'evolucao', rotulo: 'Evolução observada', tipo: 'area' },
          { nome: 'dificuldades', rotulo: 'Dificuldades', tipo: 'area', opcional: true },
          { nome: 'retomar', rotulo: 'Próximos passos', tipo: 'area', opcional: true },
        ]}
      />

      <Cadastro
        titulo="Necessidades educacionais"
        tipo="necessidades"
        aviso="Use este módulo só com informações relevantes ao acompanhamento do aluno. O acesso é restrito ao professor responsável e à administração."
        campos={[
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'adaptacao', rotulo: 'Adaptação pedagógica necessária', tipo: 'area' },
          { nome: 'descricao', rotulo: 'Descrição / diagnóstico informado', tipo: 'area', opcional: true },
          {
            nome: 'informacao',
            rotulo: 'Informação complementar e origem',
            tipo: 'area',
            opcional: true,
          },
        ]}
      />

      <p>
        Notas e comparações estão em Avaliações. A situação de cada conteúdo fica em
        Disciplinas.
      </p>
    </>
  );
}

