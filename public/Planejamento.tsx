import { useState } from 'react';
import type { Dados } from '../src/banco';
import Cadastro from './Cadastro';

export default function Planejamento() {
  const [modelo, setModelo] = useState<Dados>();

  return (
    <>
      <h2>Planejamento pedagógico</h2>
      <p>Planeje as aulas, acompanhe os conteúdos trabalhados e registre os resultados.</p>

      <Cadastro
        titulo="Planos de aula"
        tipo="planejamentos"
        valoresIniciais={modelo}
        campos={[
          { nome: 'aulaId', rotulo: 'Aula', fonte: 'aulas' },
          { nome: 'previsto', rotulo: 'Conteúdo previsto', tipo: 'area' },
          { nome: 'objetivos', rotulo: 'Objetivos da aula', tipo: 'area' },
          { nome: 'metodologia', rotulo: 'Metodologia de ensino', tipo: 'area', opcional: true },
          { nome: 'atividades', rotulo: 'Atividades planejadas', tipo: 'area', opcional: true },
          {
            nome: 'conteudos',
            rotulo: 'Conteúdos cadastrados',
            fonte: 'conteudos',
            tipo: 'multiplo',
            opcional: true,
          },
          {
            nome: 'materiais',
            rotulo: 'Materiais de apoio',
            fonte: 'materiais',
            tipo: 'multiplo',
            opcional: true,
          },
          { nome: 'trabalhado', rotulo: 'Conteúdo realmente trabalhado', tipo: 'area', opcional: true },
          { nome: 'resultado', rotulo: 'Resultado da aula', tipo: 'area', opcional: true },
          { nome: 'observacoes', rotulo: 'Observações do professor', tipo: 'area', opcional: true },
          {
            nome: 'statusConteudo',
            rotulo: 'Status do conteúdo',
            opcoes: ['Planejado', 'Em andamento', 'Concluído'],
            inicial: 'Planejado',
          },
          { nome: 'tarefa', rotulo: 'Tarefa de casa e orientações', tipo: 'area', opcional: true },
          { nome: 'retomar', rotulo: 'Conteúdo a retomar na próxima aula', tipo: 'area', opcional: true },
        ]}
      />

      <Cadastro
        titulo="Modelos reutilizáveis"
        tipo="modelos"
        acoes={(registro) => (
          <button
            type="button"
            onClick={() => {
              const dados = { ...registro.dados };
              delete dados.nome;
              setModelo(dados);
            }}
          >
            Usar modelo
          </button>
        )}
        campos={[
          { nome: 'nome', rotulo: 'Nome do modelo' },
          { nome: 'previsto', rotulo: 'Conteúdo previsto', tipo: 'area' },
          { nome: 'objetivos', rotulo: 'Objetivos da aula', tipo: 'area' },
          { nome: 'metodologia', rotulo: 'Metodologia de ensino', tipo: 'area', opcional: true },
          { nome: 'atividades', rotulo: 'Atividades planejadas', tipo: 'area', opcional: true },
        ]}
      />
    </>
  );
}
