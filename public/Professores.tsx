import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CadastroProfessor, Horario, Professor } from '../src/modulos/Professores';
import { api } from './api';

const dias = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
type Formulario = Omit<CadastroProfessor, 'disciplinas' | 'valorHora'> & {
  disciplinas: string;
  valorHora: string;
};

function novoCadastro(): Formulario {
  return {
    nome: '',
    contato: '',
    email: '',
    disciplinas: '',
    valorHora: '',
    modalidade: 'Presencial',
    horarios: [{ dia: 1, inicio: '', fim: '' }],
    endereco: '',
    recebimento: '',
    perfil: 'Professor',
    ativo: true,
  };
}

export default function Professores({ administrador = true }: { administrador?: boolean }) {
  const [lista, setLista] = useState<Professor[]>([]);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [original, setOriginal] = useState<Professor | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [carregando, setCarregando] = useState(true);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setLista(await api<Professor[]>('/professores'));
      setCarregado(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void carregar();
  }, []);

  async function abrir(professor?: Professor) {
    let cadastro = novoCadastro();
    if (!professor) {
      setSalvando(true);
      setErro('');
      try {
        const ajustes = await api<{ valorHora: number }>('/configuracoes');
        cadastro.valorHora = String(ajustes.valorHora);
      } catch (e) {
        setErro((e as Error).message);
        return;
      } finally {
        setSalvando(false);
      }
    }
    setOriginal(professor ?? null);
    setFormulario(
      professor
        ? {
            ...professor,
            disciplinas: professor.disciplinas.join(', '),
            valorHora: String(professor.valorHora),
            horarios: professor.horarios.map((horario) => ({ ...horario })),
          }
        : cadastro,
    );
    setErro('');
    setMensagem('');
  }
  function campo<K extends keyof Formulario>(nome: K, valor: Formulario[K]) {
    setFormulario((atual) => (atual ? { ...atual, [nome]: valor } : atual));
  }
  function alterarHorario(indice: number, alteracao: Partial<Horario>) {
    if (formulario)
      campo(
        'horarios',
        formulario.horarios.map((horario, i) =>
          i === indice ? { ...horario, ...alteracao } : horario,
        ),
      );
  }
  function atualizarLista(professor: Professor) {
    setLista((atual) =>
      atual.some((item) => item.id === professor.id)
        ? atual.map((item) => (item.id === professor.id ? professor : item))
        : [professor, ...atual],
    );
  }
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario || salvando) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    const dados = {
      ...formulario,
      disciplinas: formulario.disciplinas
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      valorHora: Number(formulario.valorHora),
      ...(original ? { versao: original.versao } : {}),
    };
    try {
      const professor = await api<Professor>(
        original ? `/professores/${original.id}` : '/professores',
        original ? 'PUT' : 'POST',
        dados,
      );
      atualizarLista(professor);
      window.dispatchEvent(new Event('cadastro-atualizado'));
      setFormulario(null);
      setMensagem(original ? 'Cadastro atualizado.' : 'Professor cadastrado.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  async function mudarStatus(professor: Professor) {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      const atualizado = await api<Professor>(`/professores/${professor.id}/status`, 'PATCH', {
        ativo: !professor.ativo,
        versao: professor.versao,
      });
      atualizarLista(atualizado);
      setMensagem(atualizado.ativo ? 'Professor ativado.' : 'Professor inativado.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const encontrados = lista.filter(
    (professor) =>
      normalizar(
        `${professor.nome} ${professor.email} ${professor.disciplinas.join(' ')}`,
      ).includes(normalizar(busca.trim())) &&
      (filtro === 'Todos' || professor.ativo === (filtro === 'Ativos')),
  );

  return (
    <div className="professores">
      <div className="cabecalho">
        <h2>Professores</h2>
        {administrador && (
          <button
            disabled={!!formulario || salvando || carregando || !carregado}
            onClick={() => abrir()}
          >
            Cadastrar professor
          </button>
        )}
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="sucesso" role="status">
          {mensagem}
        </p>
      )}

      {formulario && (
        <form onSubmit={salvar}>
          <h3>{original ? 'Editar professor' : 'Novo professor'}</h3>
          <p>Campos com * são obrigatórios.</p>
          <fieldset disabled={salvando}>
            <div className="campos">
              <label>
                Nome *
                <input
                  required
                  maxLength={150}
                  autoFocus
                  value={formulario.nome}
                  onChange={(e) => campo('nome', e.target.value)}
                />
              </label>
              <label>
                Contato *
                <input
                  type="tel"
                  required
                  maxLength={100}
                  value={formulario.contato}
                  onChange={(e) => campo('contato', e.target.value)}
                />
              </label>
              <label>
                E-mail *
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={formulario.email}
                  onChange={(e) => campo('email', e.target.value)}
                />
              </label>
              <label>
                Valor da hora-aula (R$) *
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  step="0.01"
                  value={formulario.valorHora}
                  onChange={(e) => campo('valorHora', e.target.value)}
                />
              </label>
              <label>
                Disciplinas *
                <input
                  required
                  maxLength={3028}
                  placeholder="Ex.: Matemática, Física"
                  value={formulario.disciplinas}
                  onChange={(e) => campo('disciplinas', e.target.value)}
                />
                <small>Separe os nomes por vírgula.</small>
              </label>
              <label>
                Modalidade
                <select
                  value={formulario.modalidade}
                  onChange={(e) =>
                    campo('modalidade', e.target.value as CadastroProfessor['modalidade'])
                  }
                >
                  <option>Presencial</option>
                  <option>On-line</option>
                  <option>Presencial e on-line</option>
                </select>
              </label>
              <label>
                Endereço de atendimento
                <textarea
                  maxLength={500}
                  value={formulario.endereco}
                  onChange={(e) => campo('endereco', e.target.value)}
                />
              </label>
              <label>
                Dados para recebimento
                <textarea
                  maxLength={500}
                  placeholder="Ex.: chave Pix"
                  value={formulario.recebimento}
                  onChange={(e) => campo('recebimento', e.target.value)}
                />
              </label>
              <label>
                Perfil do cadastro
                <select
                  disabled={!administrador}
                  value={formulario.perfil}
                  onChange={(e) => campo('perfil', e.target.value as CadastroProfessor['perfil'])}
                >
                  <option>Professor</option>
                  <option>Administrador</option>
                </select>
                <small>O usuário e suas permissões são definidos na tela Segurança.</small>
              </label>
              <label>
                Status do cadastro
                <select
                  disabled={!administrador}
                  value={String(formulario.ativo)}
                  onChange={(e) => campo('ativo', e.target.value === 'true')}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>
            </div>
            <h4>Dias e horários de atendimento *</h4>
            {formulario.horarios.map((horario, indice) => (
              <div className="horario" key={indice}>
                <label>
                  Dia {indice + 1}
                  <select
                    value={horario.dia}
                    onChange={(e) => alterarHorario(indice, { dia: Number(e.target.value) })}
                  >
                    {dias.map((dia, i) => (
                      <option key={dia} value={i}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Início {indice + 1}
                  <input
                    type="time"
                    required
                    value={horario.inicio}
                    onChange={(e) => alterarHorario(indice, { inicio: e.target.value })}
                  />
                </label>
                <label>
                  Fim {indice + 1}
                  <input
                    type="time"
                    required
                    value={horario.fim}
                    onChange={(e) => alterarHorario(indice, { fim: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  disabled={formulario.horarios.length === 1}
                  onClick={() =>
                    campo(
                      'horarios',
                      formulario.horarios.filter((_, i) => i !== indice),
                    )
                  }
                  aria-label={`Remover horário ${indice + 1}`}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={formulario.horarios.length >= 50}
              onClick={() =>
                campo('horarios', [...formulario.horarios, { dia: 1, inicio: '', fim: '' }])
              }
            >
              Adicionar horário
            </button>
            <div className="acoes formulario-acoes">
              <button type="submit" className="principal">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormulario(null);
                  setErro('');
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="filtros">
        <label>
          Buscar professor
          <input
            type="search"
            placeholder="Nome, e-mail ou disciplina"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <label>
          Filtrar por status
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option>Todos</option>
            <option>Ativos</option>
            <option>Inativos</option>
          </select>
        </label>
        <button disabled={carregando || salvando || !!formulario} onClick={carregar}>
          Atualizar lista
        </button>
      </div>
      {carregando ? (
        <p role="status">Carregando professores...</p>
      ) : (
        carregado && (
          <>
            <p>{encontrados.length} professor(es) encontrado(s).</p>
            {!encontrados.length ? (
              <p>
                {lista.length
                  ? 'Nenhum resultado para esses filtros.'
                  : 'Nenhum professor cadastrado.'}
              </p>
            ) : (
              <div className="tabela">
                <table>
                  <caption>Professores cadastrados</caption>
                  <thead>
                    <tr>
                      <th scope="col">Nome e contato</th>
                      <th scope="col">Disciplinas</th>
                      <th scope="col">Hora-aula</th>
                      <th scope="col">Modalidade</th>
                      <th scope="col">Status</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encontrados.map((professor) => (
                      <tr key={professor.id}>
                        <td>
                          {professor.nome}
                          <small>{professor.email}</small>
                          <small>{professor.contato}</small>
                        </td>
                        <td>{professor.disciplinas.join(', ')}</td>
                        <td>{dinheiro.format(professor.valorHora)}</td>
                        <td>{professor.modalidade}</td>
                        <td>{professor.ativo ? 'Ativo' : 'Inativo'}</td>
                        <td>
                          <div className="acoes">
                            <button
                              disabled={salvando || carregando || !!formulario}
                              onClick={() => abrir(professor)}
                              aria-label={`Editar ${professor.nome}`}
                            >
                              Editar
                            </button>
                            {administrador && (
                              <button
                                disabled={salvando || carregando || !!formulario}
                                onClick={() => mudarStatus(professor)}
                                aria-label={`${professor.ativo ? 'Inativar' : 'Ativar'} ${professor.nome}`}
                              >
                                {professor.ativo ? 'Inativar' : 'Ativar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
