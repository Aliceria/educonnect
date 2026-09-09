import Alunos from './Alunos';
import Agendamento from './Agendamento';
import Planejamento from './Planejamento';
import Acompanhamento from './Acompanhamento';
import Pagamentos from './Pagamentos';
import Comunicacao from './Comunicacao';
import AreaProfessor from './AreaProfessor';
import Dashboard from './Dashboard';
import { useEffect, useState } from 'react';
import type { Usuario } from '../src/banco';
import { api } from './api';
import Professores from './Professores';
import Disciplinas from './Disciplinas';
import Materiais from './Materiais';
import Avaliacoes from './Avaliacoes';
import Presenca from './Presenca';
import Relatorios from './Relatorios';
import Configuracoes from './Configuracoes';
import Seguranca, { Entrada } from './Seguranca';
import Historico from './Historico';

const modulos = [
  {id:'alunos', nome:'Alunos', tela:Alunos},
  {id:'agendamento', nome:'Agenda', tela:Agendamento},
  {id:'planejamento', nome:'Planejamento', tela:Planejamento},
  {id:'acompanhamento', nome:'Acompanhamento', tela:Acompanhamento},
  {id:'pagamentos', nome:'Pagamentos', tela:Pagamentos},
  {id:'comunicacao', nome:'Comunicação', tela:Comunicacao},
  {id:'areaProfessor', nome:'Minha área', tela:AreaProfessor},
  {id:'dashboard', nome:'Dashboard', tela:Dashboard},
  { id: 'professores', nome: 'Professores', tela: Professores },
  { id: 'disciplinas', nome: 'Disciplinas', tela: Disciplinas },
  { id: 'materiais', nome: 'Materiais', tela: Materiais },
  { id: 'avaliacoes', nome: 'Avaliações', tela: Avaliacoes },
  { id: 'presenca', nome: 'Presença', tela: Presenca },
  { id: 'relatorios', nome: 'Relatórios', tela: Relatorios },
  { id: 'configuracoes', nome: 'Configurações', tela: Configuracoes },
  { id: 'seguranca', nome: 'Segurança', tela: Seguranca },
  { id: 'historico', nome: 'Histórico', tela: Historico },
];
export default function App() {
  const [usuario, setUsuario] = useState<(Usuario & { sessaoMinutos?: number }) | null>(null);
  const [selecionado, setSelecionado] = useState('dashboard');
  const [visitados, setVisitados] = useState<string[]>([]);
  const [aviso, setAviso] = useState('');
  function entrar(u: Usuario) {
    setUsuario(u);
    setAviso('');
    const primeiro =
      u.perfil === 'Administrador'
        ? 'dashboard'
        : (modulos.find((m) => u.permissoes.includes(m.id))?.id ?? '');
    setSelecionado(primeiro);
    setVisitados(primeiro ? [primeiro] : []);
  }
  async function sair() {
    try {
      await api('/auth/sair', 'POST', {});
    } finally {
      setUsuario(null);
      setVisitados([]);
    }
  }
  useEffect(() => {
    if (!usuario) return;
    let timer: ReturnType<typeof setTimeout>;
    let ultimaRenovacao = Date.now();
    let renovando = false;
    const encerrar = () => {
      setUsuario(null);
      setVisitados([]);
      setAviso('Sessão encerrada. Entre novamente.');
    };
    const atividade = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          void api('/auth/sair', 'POST', {}).catch(() => {});
          encerrar();
        },
        (usuario.sessaoMinutos ?? 20) * 60000,
      );
      if (!renovando && Date.now() - ultimaRenovacao > 60000) {
        renovando = true;
        void api('/auth/eu')
          .then(() => {
            ultimaRenovacao = Date.now();
          })
          .catch(() => {})
          .finally(() => {
            renovando = false;
          });
      }
    };
    atividade();
    window.addEventListener('sessao-encerrada', encerrar);
    window.addEventListener('pointerdown', atividade);
    window.addEventListener('keydown', atividade);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('sessao-encerrada', encerrar);
      window.removeEventListener('pointerdown', atividade);
      window.removeEventListener('keydown', atividade);
    };
  }, [usuario]);
  const permitidos = modulos.filter(
    (m) =>
      usuario &&
      (usuario.perfil === 'Administrador' ||
        (!['configuracoes', 'seguranca'].includes(m.id) && usuario.permissoes.includes(m.id))),
  );
  const grupos = [
 {nome:'Visão geral', ids:['dashboard','areaProfessor']},
 {nome:'Aulas', ids:['alunos','agendamento','planejamento','acompanhamento']},
 {nome:'Atendimento', ids:['pagamentos','comunicacao']},
    { nome: 'Gestão', ids: ['professores', 'disciplinas', 'materiais'] },
    { nome: 'Acompanhamento', ids: ['avaliacoes', 'presenca', 'relatorios'] },
    { nome: 'Sistema', ids: ['configuracoes', 'seguranca', 'historico'] },
  ];
  const marca = (
    <div className="marca">
      <strong>EduConnect</strong>
      <span>Aulas particulares</span>
    </div>
  );
  if (!usuario)
    return (
      <main className="acesso">
        <header>{marca}</header>
        {aviso && <p role="status">{aviso}</p>}
        <Entrada onEntrar={entrar} />
      </main>
    );
  if (['Aluno','Responsável'].includes(usuario.perfil)) return <main className="acesso portal"><header className="cabecalho">{marca}<button onClick={()=>void sair()}>Sair</button></header><AreaProfessor/></main>;
  return (
    <div className="aplicacao">
      <a className="pular" href="#conteudo">
        Ir para o conteúdo
      </a>
      <aside className="lateral">
        {marca}
        <nav aria-label="Módulos">
          {grupos.map((g) => {
            const itens = permitidos.filter((m) => g.ids.includes(m.id));
            return (
              itens.length > 0 && (
                <div className="grupo-menu" key={g.nome}>
                  <p>{g.nome}</p>
                  {itens.map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={selecionado === m.id}
                      onClick={() => {
                        setSelecionado(m.id);
                        setVisitados((v) => (v.includes(m.id) ? v : [...v, m.id]));
                      }}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              )
            );
          })}
        </nav>
        <div className="conta">
          <span className="avatar" aria-hidden="true">
            {usuario.nome
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </span>
          <div>
            <strong>{usuario.nome}</strong>
            <small>{usuario.perfil}</small>
          </div>
          <button onClick={() => void sair().catch(() => setAviso('Sessão encerrada localmente.'))}>
            Sair
          </button>
        </div>
      </aside>
      <div className="area-principal">
        <header className="topo">
          <span>{modulos.find((m) => m.id === selecionado)?.nome ?? 'EduConnect'}</span>
          <time dateTime={new Date().toISOString().slice(0, 10)}>
            {new Date().toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </time>
        </header>
        <main id="conteudo" tabIndex={-1}>
          {aviso && <p role="status">{aviso}</p>}
          {!permitidos.length && <p>Nenhum módulo liberado. Solicite acesso ao administrador.</p>}
          {permitidos
            .filter((m) => visitados.includes(m.id))
            .map((m) => {
              const Tela = m.tela;
              return (
                <section
                  className="pagina-modulo"
                  key={m.id}
                  hidden={selecionado !== m.id}
                  aria-label={m.nome}
                >
                  {m.id === 'professores' ? (
                    <Professores administrador={usuario.perfil === 'Administrador'} />
                  ) : (
                    <Tela />
                  )}
                </section>
              );
            })}
        </main>
      </div>
    </div>
  );
}
