import { camposAgenda } from './agenda/campos';
import { useState } from 'react';
import Cadastro from './Cadastro';
import type { Registro } from '../src/banco';
import { api } from './api';
import { horarioFinal, horarioForaDisponibilidade } from './agenda/auxiliares';
import AgendaPeriodo from './agenda/AgendaPeriodo';
export default function Agendamento() {
  const [repeticao, setRepeticao] = useState<Registro | null>(null);
  const [quantidade, setQuantidade] = useState(4);
  const [aula, setAula] = useState<Registro | null>(null);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState<Registro | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function reagendar() {
    if (!aula) return;
    try {
      await api('/aulas/' + aula.id + '/reagendar', 'POST', {
        data,
        hora,
        versao: aula.versao,
      });
      setAula(null);
      window.dispatchEvent(new Event('cadastro-atualizado'));
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <>
      <h2>Agenda</h2>
      <Cadastro
        titulo="Aulas"
        tipo="aulas"
        campos={camposAgenda}
        complementoFormulario={(dados, referencias) => (
          <>
            <p role="status">{horarioFinal(String(dados.hora ?? ''), dados.duracaoMinutos)}</p>
            {horarioForaDisponibilidade(dados, referencias) && (
              <p className="aviso-disponibilidade" role="alert">
                Horário fora da disponibilidade do professor.
              </p>
            )}
          </>
        )}
        rodape={(aulas, refs) => <AgendaPeriodo aulas={aulas} referencias={refs} />}
        acoes={(r) => <>
          <button onClick={() => { setExcluindo(r); setErro(''); }}>Excluir aula</button>
          {r.dados.status === 'Agendada' && (
            <>
              <button
                onClick={() => {
                  setRepeticao(r);
                  setErro('');
                }}
              >
                Repetir semanalmente
              </button>
              <button
                onClick={() => {
                  setAula(r);
                  setData(String(r.dados.data));
                  setHora(String(r.dados.hora));
                  setErro('');
                }}
              >
                Reagendar
              </button>
            </>
          )}</>
        }
      />
      {excluindo && <section className="cadastro" aria-label="Confirmar exclusão">
        <h3>Excluir aula</h3>
        <p>Excluir {String(excluindo.dados.nome)}? A frequência associada será removida e o saldo do pacote será recalculado. O histórico será mantido.</p>
        <p>Aulas com planejamento, materiais, acompanhamento ou outras aulas vinculadas precisam ter esses vínculos resolvidos primeiro.</p>
        {erro && <p role="alert">{erro}</p>}
        <button disabled={ocupado} onClick={async () => {
          setOcupado(true); setErro('');
          try {
            await api('/registros/aulas/' + excluindo.id, 'DELETE', { versao: excluindo.versao });
            setExcluindo(null);
            window.dispatchEvent(new Event('cadastro-atualizado'));
          } catch (e) { setErro((e as Error).message); }
          finally { setOcupado(false); }
        }}>{ocupado ? 'Excluindo...' : 'Confirmar exclusão'}</button>{' '}
        <button disabled={ocupado} onClick={() => setExcluindo(null)}>Manter aula</button>
      </section>}
      {repeticao && (
        <section className="cadastro">
          <h3>Repetir aula semanalmente</h3>
          <p>
            As novas aulas terão o mesmo aluno, horário e pacote. Se houver conflito ou falta de
            saldo, nenhuma repetição será criada.
          </p>
          {erro && <p role="alert">{erro}</p>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/aulas/' + repeticao.id + '/repetir', 'POST', {
                  quantidade,
                });
                setRepeticao(null);
                window.dispatchEvent(new Event('cadastro-atualizado'));
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            <label>
              Quantidade de novas aulas
              <input
                type="number"
                min="1"
                max="52"
                step="1"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </label>
            <button type="submit">Criar repetições</button>{' '}
            <button type="button" onClick={() => setRepeticao(null)}>
              Cancelar
            </button>
          </form>
        </section>
      )}
      {aula && (
        <section className="cadastro">
          <h3>Reagendar aula</h3>
          <p>A aula original ficará no histórico.</p>
          {erro && <p role="alert">{erro}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void reagendar();
            }}
          >
            <div className="campos">
              <label>
                Nova data
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
              <label>
                Novo horário
                <input
                  type="time"
                  step={60}
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </label>
            </div>
            <p role="status">{horarioFinal(hora, aula.dados.duracaoMinutos)}</p>
            <button type="submit">Salvar reagendamento</button>{' '}
            <button type="button" onClick={() => setAula(null)}>
              Cancelar
            </button>
          </form>
        </section>
      )}
    </>
  );
}
