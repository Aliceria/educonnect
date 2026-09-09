import { useEffect, useState } from 'react';
import Cadastro from './Cadastro';
import { api } from './api';
import type { Registro } from '../src/banco';

export default function Pagamentos() {
  const [saldos, setSaldos] = useState<
    Array<Registro & { realizadas: number; cobradas: number; restantes: number; agendadas: number }>
  >([]);
  const [erro, setErro] = useState('');

  function carregar() {
    api<typeof saldos>('/saldos')
      .then(setSaldos)
      .catch((e) => setErro((e as Error).message));
  }

  useEffect(() => {
    carregar();

    window.addEventListener('cadastro-atualizado', carregar);

    return () => {
      window.removeEventListener('cadastro-atualizado', carregar);
    };
  }, []);

  return (
    <>
      <h2>Pacotes e pagamentos</h2>

      <Cadastro
        titulo="Pacotes de aulas"
        tipo="pacotes"
        campos={[
          { nome: 'nome', rotulo: 'Nome' },
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          {
            nome: 'quantidade',
            rotulo: 'Aulas contratadas',
            tipo: 'numero',
            minimo: 1,
            inicial: 4,
          },
          { nome: 'valor', rotulo: 'Valor do pacote (R$)', tipo: 'numero' },
          {
            nome: 'politicaFalta',
            rotulo: 'Falta do aluno',
            opcoes: ['Não cobrar', 'Cobrar'],
          },
          {
            nome: 'politicaCancelamento',
            rotulo: 'Cancelamento pelo aluno',
            opcoes: ['Não cobrar', 'Cobrar'],
          },
        ]}
      />

      <section className="cadastro">
        <h3>Saldo de aulas</h3>

        {erro && <p role="alert">{erro}</p>}

        {saldos.length ? (
          saldos.map((p) => (
            <p key={p.id}>
              {String(p.dados.nome)}: {p.realizadas} realizadas, {p.cobradas}{' '}
              faltas/cancelamentos cobrados, {p.restantes} restantes ({p.agendadas}{' '}
              agendadas).
            </p>
          ))
        ) : (
          <p>Nenhum pacote com saldo registrado.</p>
        )}
      </section>

      <Cadastro
        titulo="Pagamentos"
        tipo="pagamentos"
        campos={[
          { nome: 'nome', rotulo: 'Descrição' },
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'numero' },
          { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'data' },
          { nome: 'status', rotulo: 'Situação', opcoes: ['Pendente', 'Recebido', 'Vencido'] },
          { nome: 'recebidoEm', rotulo: 'Recebido em', tipo: 'data', opcional: true },
          { nome: 'pacoteId', rotulo: 'Pacote', fonte: 'pacotes', opcional: true },
          { nome: 'forma', rotulo: 'Forma de pagamento', inicial: 'Pix' },
          { nome: 'comprovante', rotulo: 'Referência do comprovante', tipo: 'area', opcional: true },
        ]}
      />
    </>
  );
}

