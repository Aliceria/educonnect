import { useState } from 'react';
import type { Dados } from '../src/banco';
import Cadastro from './Cadastro';

export default function Planejamento() {
  const [modelo, setModelo] = useState<Dados>();

  return (
    <>
      <h2>Planejamento</h2>

      <Cadastro
        titulo="Planos de aula"
        tipo="planejamentos"
        valoresIniciais={modelo}
        campos={[
          { nome: 'aulaId', rotulo: 'Aula', fonte: 'aulas' },
          { nome: 'previsto', rotulo: 'Conteúdo previsto', tipo: 'area' },
          { nome: 'objetivos', rotulo: 'Objetivos', tipo: 'area' },
          { nome: 'atividades', rotulo: 'Atividades', tipo: 'area', opcional: true },
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
          {
            nome: 'tarefa',
            rotulo: 'Tarefa de casa e orientações',
            tipo: 'area',
            opcional: true,
          },
          { nome: 'retomar', rotulo: 'Retomar na próxima aula', tipo: 'area', opcional: true },
        ]}
      />

      <Cadastro
        titulo="Modelos reutilizáveis"
        tipo="modelos"
        acoes={(r) => (
          <button onClick={() => setModelo({ ...r.dados })}>Usar modelo em novo plano</button>
        )}
        campos={[
          { nome: 'nome', rotulo: 'Nome do modelo' },
          { nome: 'previsto', rotulo: 'Conteúdo previsto', tipo: 'area' },
          { nome: 'objetivos', rotulo: 'Objetivos', tipo: 'area' },
          { nome: 'atividades', rotulo: 'Atividades', tipo: 'area', opcional: true },
        ]}
      />
    </>
  );
}

