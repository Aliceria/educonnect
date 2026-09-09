import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from './api';
type Ajustes = {
  instituicao: string;
  contato: string;
  valorHora: number;
  horarios: string;
  lembretesMinutos: number;
  formasPagamento: string;
  modeloMensagem: string;
  modeloPlano: string;
  sessaoMinutos: number;
  backupHoras: number;
};
export default function Configuracoes() {
  const [dados, setDados] = useState<Ajustes | null>(null);
  const [arquivos, setArquivos] = useState<Array<{ nome: string; tamanho: number }>>([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function carregar() {
    try {
      const [d, b] = await Promise.all([
        api<Ajustes>('/configuracoes'),
        api<{ arquivos: typeof arquivos; erro: string }>('/backups'),
      ]);
      setDados(d);
      setArquivos(b.arquivos);
      if (b.erro) setErro(b.erro);
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  useEffect(() => {
    void carregar();
  }, []);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      setDados(await api('/configuracoes', 'PUT', dados));
      setMensagem('Configurações salvas.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  async function backup() {
    setOcupado(true);
    setErro('');
    try {
      await api('/backups', 'POST', {});
      await carregar();
      setMensagem('Backup criado.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  const campos = [
    ['instituicao', 'Professor ou instituição'],
    ['contato', 'Contato'],
    ['valorHora', 'Valor padrão da hora-aula (R$)'],
    ['horarios', 'Horários de atendimento'],
    ['lembretesMinutos', 'Antecedência do lembrete (minutos)'],
    ['formasPagamento', 'Formas de pagamento'],
    ['modeloMensagem', 'Modelo de mensagem'],
    ['modeloPlano', 'Modelo de plano de aula'],
    ['sessaoMinutos', 'Encerrar sessão após inatividade (minutos)'],
    ['backupHoras', 'Intervalo de backup (horas)'],
  ] as const;
  return (
    <div className="cadastro">
      <h2>Configurações</h2>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
      {dados && (
        <form onSubmit={salvar}>
          <fieldset disabled={ocupado}>
            <div className="campos">
              {campos.map(([chave, rotulo]) => (
                <label key={chave}>
                  {rotulo}
                  {typeof dados[chave] === 'number' ? (
                    <input
                      type="number"
                      required
                      step="0.01"
                      min={chave === 'sessaoMinutos' ? 5 : chave === 'backupHoras' ? 1 : 0}
                      max={
                        chave === 'sessaoMinutos'
                          ? 120
                          : chave === 'backupHoras'
                            ? 168
                            : chave === 'lembretesMinutos'
                              ? 10080
                              : 1000000
                      }
                      value={dados[chave]}
                      onChange={(e) => setDados({ ...dados, [chave]: Number(e.target.value) })}
                    />
                  ) : (
                    <textarea
                      maxLength={chave.startsWith('modelo') ? 10000 : 2000}
                      value={dados[chave]}
                      onChange={(e) => setDados({ ...dados, [chave]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            <button type="submit">Salvar configurações</button>
          </fieldset>
        </form>
      )}
      <p>
        Horários, valores e modelos ficam disponíveis para os módulos da equipe. Lembretes precisam
        da integração com Comunicação (6).
      </p>
      <h3>Backup do banco</h3>
      <p>
        O backup inclui cadastros, usuários, histórico e anexos. O backup automático funciona
        enquanto o backend está aberto.
      </p>
      <button disabled={ocupado} onClick={backup}>
        Criar backup agora
      </button>
      <ul>
        {arquivos.map((a) => (
          <li key={a.nome}>
            <a href={`/api/backups/${a.nome}`}>{a.nome}</a> ({Math.ceil(a.tamanho / 1024)} KB)
          </li>
        ))}
      </ul>
      <p>
        Para recuperar: pare o backend, guarde uma cópia do banco atual e substitua
        dados/educonnect.sqlite pelo backup escolhido. Depois inicie o backend novamente.
      </p>
    </div>
  );
}
