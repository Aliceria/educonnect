import { useEffect, useState } from 'react';
import { api } from './api';
import type { meusDados } from '../src/modulos/AreaProfessor';

export default function AreaProfessor() {
  const [dados, setDados] = useState<ReturnType<typeof meusDados> | null>(null);
  const [erro, setErro] = useState('');
  const [tipo, setTipo] = useState('Correção');
  const [descricao, setDescricao] = useState('');
  const [perfil, setPerfil] = useState<{ nome: string; email: string; telefone: string } | null>(null);
  const [pedido, setPedido] = useState('');
  const [resposta, setResposta] = useState('');

  function carregar() {
    api<ReturnType<typeof meusDados>>('/meus-dados')
      .then(setDados)
      .catch((e) => setErro((e as Error).message));
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <>
      <h2>Minha área</h2>

      {erro && <p role="alert">{erro}</p>}

      <section className="cadastro">
        <h3>Meus dados</h3>

        {dados && (
          <>
            <p>{dados.usuario.nome}</p>
            <p>{dados.usuario.email}</p>
            <p>{dados.usuario.telefone}</p>
            <p>{dados.usuario.perfil}</p>

            <button
              onClick={() =>
                setPerfil({
                  nome: dados.usuario.nome,
                  email: dados.usuario.email,
                  telefone: dados.usuario.telefone ?? '',
                })
              }
            >
              Editar meus dados
            </button>
          </>
        )}

        {perfil && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              try {
                await api('/auth/perfil', 'PUT', perfil);
                setPerfil(null);
                carregar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            <label>
              Nome
              <input
                required
                value={perfil.nome}
                onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                required
                value={perfil.email}
                onChange={(e) => setPerfil({ ...perfil, email: e.target.value })}
              />
            </label>

            <label>
              Telefone
              <input
                value={perfil.telefone}
                onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
              />
            </label>

            <button type="submit">Salvar perfil</button>
            <button type="button" onClick={() => setPerfil(null)}>
              Cancelar
            </button>
          </form>
        )}
      </section>

      {dados?.aluno && (
        <>
          <section className="cadastro">
            <h3>Cadastro do aluno</h3>
            {Object.entries(dados.aluno).map(([campo, valor]) => (
              <p key={campo}>
                {campo}: {String(valor ?? '')}
              </p>
            ))}
          </section>

          <section className="cadastro">
            <h3>Agenda e tarefas</h3>

            {dados.aulas.map((a) => (
              <p key={a.id}>
                {String(a.data)} às {String(a.hora)} — {String(a.status)}{' '}
                {Boolean(a.link) && (
                  <a href={String(a.link)} target="_blank" rel="noreferrer">
                    Videochamada
                  </a>
                )}
              </p>
            ))}

            {dados.tarefas.map((t) => (
              <p key={t.id}>{String(t.tarefa)}</p>
            ))}
          </section>

          <section className="cadastro">
            <h3>Materiais compartilhados</h3>

            {dados.materiais.length ? (
              dados.materiais.map((m) => (
                <p key={m.id}>
                  <a href={`/api/compartilhados/${m.id}`} target="_blank" rel="noreferrer">
                    {m.nome}
                  </a>
                </p>
              ))
            ) : (
              <p>Nenhum material disponível.</p>
            )}
          </section>

          {dados.usuario.perfil === 'Responsável' && (
            <section className="cadastro">
              <h3>Pagamentos</h3>

              {dados.pagamentos.map((p) => (
                <p key={p.id}>
                  {String(p.vencimento)} —{' '}
                  {Number(p.valor).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}{' '}
                  — {String(p.status)}
                </p>
              ))}
            </section>
          )}
        </>
      )}

      <section className="cadastro">
        <h3>LGPD e privacidade</h3>

        <p>
          Este espaço reúne os dados usados para organizar aulas, acompanhamento e
          pagamentos. Professores veem apenas os alunos vinculados a eles; a
          administração cuida do sistema e dos acessos.
        </p>

        <p>
          Os dados ficam salvos localmente e nos backups. A instituição precisa definir
          prazo de guarda, responsáveis e a finalidade de cada informação. Quando há
          solicitação de correção ou exclusão, o pedido é registrado e analisado pela
          administração antes de qualquer ação.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();

            try {
              await api('/privacidade', 'POST', { tipo, descricao });
              setDescricao('');
              carregar();
            } catch (e) {
              setErro((e as Error).message);
            }
          }}
        >
          <label>
            Solicitação
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Correção</option>
              <option>Exclusão</option>
              <option>Informações sobre tratamento</option>
            </select>
          </label>

          <label>
            Descrição
            <textarea
              required
              maxLength={2000}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </label>

          <button type="submit">Registrar solicitação</button>
        </form>

        {dados?.solicitacoes.map((s) => (
          <div key={s.id}>
            <p>
              {String(s.dados.tipo)} — {String(s.dados.status)} —{' '}
              {String(s.dados.descricao)}
            </p>

            {Boolean(s.dados.resposta) && <p>Resposta: {String(s.dados.resposta)}</p>}

            {dados.usuario.perfil === 'Administrador' && (
              <button
                onClick={() => {
                  setPedido(s.id);
                  setResposta(String(s.dados.resposta ?? ''));
                }}
              >
                Responder
              </button>
            )}
          </div>
        ))}

        {pedido && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              try {
                await api('/privacidade/' + pedido, 'PUT', {
                  status: 'Concluída',
                  resposta,
                  versao: dados?.solicitacoes.find((s) => s.id === pedido)?.versao,
                });

                setPedido('');
                carregar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            <label>
              Resposta da administração
              <textarea
                required
                maxLength={2000}
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
              />
            </label>

            <button type="submit">Concluir solicitação</button>
            <button type="button" onClick={() => setPedido('')}>
              Cancelar
            </button>
          </form>
        )}
      </section>
    </>
  );
}

