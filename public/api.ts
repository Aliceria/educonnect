export async function api<T>(caminho: string, metodo = 'GET', dados?: unknown, ignorarSessaoEncerrada = false): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo, credentials: 'same-origin', signal: AbortSignal.timeout(30000),
      headers: dados === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: dados === undefined ? undefined : JSON.stringify(dados),
    });
  } catch { throw new Error('Sem resposta do servidor. Confira se o backend está rodando.'); }
  const resultado = await resposta.json().catch(() => null);
  if (resposta.status === 401 && caminho !== '/auth/entrar' && !ignorarSessaoEncerrada) window.dispatchEvent(new Event('sessao-encerrada'));
  if (!resposta.ok || resultado === null) throw new Error(resultado?.erro ?? 'Não foi possível concluir a operação.');
  return resultado as T;
}
