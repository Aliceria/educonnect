import { useState } from 'react';
import Cadastro from './Cadastro';
import { api } from './api';

export default function Comunicacao() {
  const [link, setLink] = useState('');
  const [erro, setErro] = useState('');

  async function preparar(id: string) {
    setLink('');
    setErro('');

    try {
      const resposta = await api<{ url: string }>(`/comunicacoes/${id}/abrir`);
      setLink(resposta.url);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <h2>Comunicação</h2>

      <p>
        Escreva a mensagem e envie pelo aplicativo. Depois, marque a comunicação como
        “Enviada manualmente”. O sistema registra o envio no painel, mas não confirma
        entrega pelo provedor.
      </p>

      {erro && <p role="alert">{erro}</p>}

      {link && (
        <p>
          <a href={link} target="_blank" rel="noreferrer">
            Abrir aplicativo de mensagem
          </a>
        </p>
      )}

      <Cadastro
        titulo="Mensagens e avisos"
        tipo="comunicacoes"
        campos={[
          { nome: 'alunoId', rotulo: 'Aluno', fonte: 'alunos' },
          { nome: 'destinatario', rotulo: 'Destinatário', opcoes: ['Aluno', 'Responsável'] },
          { nome: 'canal', rotulo: 'Canal', opcoes: ['E-mail', 'WhatsApp'] },
          {
            nome: 'assunto',
            rotulo: 'Assunto',
            opcoes: [
              'Confirmação de aula',
              'Lembrete de aula',
              'Pagamento pendente',
              'Cancelamento',
              'Reagendamento',
              'Tarefa e material',
              'Outro',
            ],
          },
          { nome: 'mensagem', rotulo: 'Mensagem', tipo: 'area' },
          { nome: 'status', rotulo: 'Situação', opcoes: ['Rascunho', 'Enviada manualmente'] },
        ]}
        acoes={(r) => (
          <button onClick={() => void preparar(r.id)}>Preparar envio</button>
        )}
      />
    </>
  );
}

