import { useState } from 'react';
import Professores from './modulos/Professores';
import Disciplinas from './modulos/Disciplinas';
import Materiais from './modulos/Materiais';
import Avaliacoes from './modulos/Avaliacoes';
import Presenca from './modulos/Presenca';
import Relatorios from './modulos/Relatorios';
import Configuracoes from './modulos/Configuracoes';
import Seguranca from './modulos/Seguranca';
import Historico from './modulos/Historico';

const modulos = [
  { nome: 'Professores', tela: Professores },
  { nome: 'Disciplinas', tela: Disciplinas },
  { nome: 'Materiais', tela: Materiais },
  { nome: 'Avaliações', tela: Avaliacoes },
  { nome: 'Presença', tela: Presenca },
  { nome: 'Relatórios', tela: Relatorios },
  { nome: 'Configurações', tela: Configuracoes },
  { nome: 'Segurança', tela: Seguranca },
  { nome: 'Histórico', tela: Historico },
];

export default function App() {
  const [selecionado, setSelecionado] = useState(0);
  const Tela = modulos[selecionado].tela;

  return (
    <main>
      <h1>EduConnect</h1>
      <p>Sistema para organizar aulas particulares.</p>
      <nav aria-label="Módulos">
        {modulos.map((modulo, indice) => (
          <button
            key={modulo.nome}
            onClick={() => setSelecionado(indice)}
            aria-pressed={selecionado === indice}
          >
            {modulo.nome}
          </button>
        ))}
      </nav>
      <section>
        <Tela />
      </section>
    </main>
  );
}
