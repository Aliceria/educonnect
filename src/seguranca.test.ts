import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco } from './banco.ts';
import type { Usuario } from './banco.ts';
import { backups } from './modulos/Configuracoes.ts';
import { seguranca } from './modulos/Seguranca.ts';
import { criarServidor } from './servidor.ts';

test('hash de senha, sessão, expiração, encerramento manual e recuperação de senha', async () => {
  const banco = abrirBanco(':memory:');
  try {
    const acesso = seguranca(banco);
    const inicial = await acesso.configurar({
      nome: 'Admin Segurança',
      email: 'admin@example.test',
      senha: 'SenhaSegura123',
    });
    const linha = banco.db.prepare('SELECT senha FROM usuarios WHERE id=?').get(inicial.usuario.id);
    const hash = String(linha?.senha);
    assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.notEqual(hash, 'SenhaSegura123');
    assert.equal(JSON.stringify(inicial).includes('SenhaSegura123'), false);
    const recuperacaoSalva = String(
      banco.db.prepare('SELECT recuperacao FROM usuarios WHERE id=?').get(inicial.usuario.id)?.recuperacao,
    );
    assert.equal(
      recuperacaoSalva,
      createHash('sha256').update(inicial.codigoRecuperacao).digest('hex'),
    );
    banco.evento(inicial.usuario, 'seguranca', 'Teste de mascaramento', inicial.usuario.id, {
      senha: 'senha-secreta',
      email: 'privado@example.test',
      detalhes: { token: 'token-secreto' },
    });
    const detalhesAuditados = JSON.parse(String(
      banco.db.prepare("SELECT detalhes FROM historico WHERE acao='Teste de mascaramento'")
        .get()?.detalhes,
    ));
    assert.deepEqual(detalhesAuditados, {
      senha: '[mascarado]',
      email: '[mascarado]',
      detalhes: { token: '[mascarado]' },
    });

    const entrada = await acesso.entrar(
      { email: 'ADMIN@example.test', senha: 'SenhaSegura123' },
      '127.0.0.1',
    );
    const sessaoHash = banco.db.prepare('SELECT token FROM sessoes WHERE usuarioId=?')
      .get(entrada.usuario.id)?.token;
    assert.equal(
      sessaoHash,
      createHash('sha256').update(entrada.token).digest('hex'),
    );
    assert.notEqual(sessaoHash, entrada.token);
    assert.equal(banco.db.prepare('SELECT count(*) AS n FROM sessoes WHERE usuarioId=?')
      .get(entrada.usuario.id)?.n, 1);
    assert.equal(acesso.sessao(entrada.token, 20).id, entrada.usuario.id);

    banco.db.prepare('UPDATE sessoes SET ultimaAtividade=? WHERE usuarioId=?')
      .run(Date.now() - 21 * 60_000, entrada.usuario.id);
    assert.throws(() => acesso.sessao(entrada.token, 20), /Sessão encerrada/);
    assert.equal(banco.db.prepare('SELECT count(*) AS n FROM sessoes WHERE usuarioId=?')
      .get(entrada.usuario.id)?.n, 0);

    const sessaoParaRevogar = await acesso.entrar(
      { email: 'admin@example.test', senha: 'SenhaSegura123' },
      '127.0.0.1',
    );
    acesso.sair(sessaoParaRevogar.token, sessaoParaRevogar.usuario);
    assert.throws(() => acesso.sessao(sessaoParaRevogar.token, 20), /Sessão encerrada/);

    const sessaoAntesDaRecuperacao = await acesso.entrar(
      { email: 'admin@example.test', senha: 'SenhaSegura123' },
      '127.0.0.1',
    );
    const recuperada = await acesso.recuperar({
      email: 'admin@example.test',
      codigo: inicial.codigoRecuperacao,
      senha: 'SenhaNovaSegura123',
    }, '127.0.0.1');
    assert.throws(
      () => acesso.sessao(sessaoAntesDaRecuperacao.token, 20),
      /Sessão encerrada/,
    );
    assert.notEqual(recuperada.codigoRecuperacao, inicial.codigoRecuperacao);
    await assert.rejects(
      acesso.entrar({ email: 'admin@example.test', senha: 'SenhaSegura123' }, '127.0.0.1'),
      /incorretos/,
    );
    const novaEntrada = await acesso.entrar(
      { email: 'admin@example.test', senha: 'SenhaNovaSegura123' },
      '127.0.0.1',
    );
    assert.equal(acesso.sessao(novaEntrada.token, 20).id, inicial.usuario.id);
    await assert.rejects(
      acesso.recuperar({
        email: 'admin@example.test',
        codigo: inicial.codigoRecuperacao,
        senha: 'OutraSenhaSegura123',
      }, '127.0.0.1'),
      /inválido/,
    );
    assert.equal(banco.db.prepare('SELECT count(*) AS n FROM sessoes WHERE usuarioId=?')
      .get(inicial.usuario.id)?.n, 1);
  } finally {
    banco.fechar();
  }
});

test('backup restringe acesso local e pode ser restaurado com integridade', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'educonnect-backup-'));
  const diretorioBackups = join(pasta, 'backups');
  const caminhoRestaurado = join(pasta, 'restaurado.sqlite');
  const banco = abrirBanco(':memory:');
  const admin: Usuario = {
    id: 'admin',
    nome: 'Admin',
    email: 'admin@example.test',
    perfil: 'Administrador',
    professorId: '',
    permissoes: [],
    ativo: true,
  };
  try {
    banco.salvar('alunos', { nome: 'Aluno de teste' }, admin);
    banco.db.prepare('INSERT INTO usuarios (id,email,dados,senha,recuperacao) VALUES (?,?,?,?,?)')
      .run(admin.id, admin.email, JSON.stringify(admin), 'scrypt:hash', 'codigo-hash');

    const gerenciador = backups(banco, diretorioBackups);
    const criado = await gerenciador.criar(admin);
    const arquivo = join(diretorioBackups, criado.nome);
    assert.deepEqual(gerenciador.listar().map((item) => item.nome), [criado.nome]);

    if (process.platform !== 'win32') {
      assert.equal(statSync(diretorioBackups).mode & 0o777, 0o700);
      assert.equal(statSync(arquivo).mode & 0o777, 0o600);
    }

    const copia = new DatabaseSync(arquivo, { readOnly: true });
    try {
      assert.equal(copia.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
      assert.equal(copia.prepare('SELECT count(*) AS n FROM usuarios').get()?.n, 1);
      assert.equal(copia.prepare("SELECT count(*) AS n FROM registros WHERE tipo='alunos'").get()?.n, 1);
    } finally {
      copia.close();
    }

    copyFileSync(arquivo, caminhoRestaurado);
    const restaurado = new DatabaseSync(caminhoRestaurado, { readOnly: true });
    try {
      assert.equal(restaurado.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
      assert.equal(restaurado.prepare('SELECT count(*) AS n FROM usuarios').get()?.n, 1);
      assert.equal(restaurado.prepare("SELECT count(*) AS n FROM registros WHERE tipo='alunos'").get()?.n, 1);
    } finally {
      restaurado.close();
    }
  } finally {
    banco.fechar();
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('rotas de auditoria e backup exigem sessão e permissões administrativas', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'educonnect-security-api-'));
  const servidor = criarServidor(':memory:', undefined, pasta);
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco !== 'string');
  const base = `http://127.0.0.1:${endereco.port}/api`;
  let adminCookie = '';

  async function req(path: string, method = 'GET', body?: unknown, cookie = '') {
    const resposta = await fetch(base + path, {
      method,
      headers: {
        Cookie: cookie,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: resposta.status,
      data: await resposta.json(),
      setCookie: resposta.headers.get('set-cookie') ?? '',
      cookie: resposta.headers.get('set-cookie')?.split(';')[0] ?? '',
    };
  }

  try {
    assert.equal((await req('/backups')).status, 401);
    assert.equal((await req('/historico')).status, 401);
    await req('/auth/inicial', 'POST', {
      nome: 'Admin Segurança',
      email: 'admin@example.test',
      senha: 'SenhaSegura123',
    });
    const entrada = await req('/auth/entrar', 'POST', {
      email: 'admin@example.test',
      senha: 'SenhaSegura123',
    });
    adminCookie = entrada.cookie;
    assert.match(entrada.setCookie, /HttpOnly/);
    assert.match(entrada.setCookie, /SameSite=Strict/);
    assert.match(entrada.setCookie, /Max-Age=43200/);

    const professor = await req('/professores', 'POST', {
      nome: 'Professor Teste',
      contato: '11987654321',
      email: 'professor@example.test',
      disciplinas: ['Matemática'],
      valorHora: 100,
      modalidade: 'Presencial',
      horarios: [{ dia: 1, inicio: '08:00', fim: '18:00' }],
      endereco: '',
      recebimento: '',
      perfil: 'Professor',
      ativo: true,
    }, adminCookie);
    assert.equal(professor.status, 201);
    const usuarioProfessor = await req('/usuarios', 'POST', {
      nome: 'Professor Teste',
      email: 'usuario-professor@example.test',
      senha: 'SenhaSegura123',
      perfil: 'Professor',
      professorId: professor.data.id,
      permissoes: ['dashboard'],
      ativo: true,
    }, adminCookie);
    assert.equal(usuarioProfessor.status, 201);
    const professorCookie = (await req('/auth/entrar', 'POST', {
      email: 'usuario-professor@example.test',
      senha: 'SenhaSegura123',
    })).cookie;

    assert.equal((await req('/backups', 'GET', undefined, professorCookie)).status, 403);
    assert.equal((await req('/historico', 'GET', undefined, professorCookie)).status, 403);
    assert.equal((await req('/backups', 'POST', {}, adminCookie)).status, 201);
    assert.equal((await req('/backups', 'GET', undefined, adminCookie)).status, 200);
    assert.equal((await req('/historico', 'GET', undefined, adminCookie)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((erro) => erro ? reject(erro) : resolve()),
    );
    rmSync(pasta, { recursive: true, force: true });
  }
});
