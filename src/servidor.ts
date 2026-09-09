import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirProfessores, ErroCadastro } from './modulos/Professores.ts';
import { abrirBanco, objeto, permitir } from './banco.ts';
import type { Dados, Usuario } from './banco.ts';
import { fontesVazias, referencias } from './integracao.ts';
import type { Fontes } from './integracao.ts';
import { seguranca } from './modulos/Seguranca.ts';
import { validarDisciplina, validarConteudo, validarAprendizado } from './modulos/Disciplinas.ts';
import { validarMaterial, guardarAnexo, compartilharMaterial } from './modulos/Materiais.ts';
import { validarAvaliacao } from './modulos/Avaliacoes.ts';
import { validarPresenca } from './modulos/Presenca.ts';
import { gerarRelatorio, gerarPdf } from './modulos/Relatorios.ts';
import { lerConfiguracoes, salvarConfiguracoes, backups } from './modulos/Configuracoes.ts';
import { consultarHistorico } from './modulos/Historico.ts';

export function criarServidor(
  caminhoBanco: string,
  fontes: Fontes = fontesVazias,
  pastaBackup?: string,
) {
  const banco = abrirBanco(caminhoBanco);
  const professores = abrirProfessores(banco.db);
  const acesso = seguranca(banco);
  const pasta = pastaBackup ?? fileURLToPath(new URL('../dados/backups/', import.meta.url));
  const copias = backups(banco, pasta);
  const sistema: Usuario = {
    id: 'sistema',
    nome: 'Sistema',
    email: '',
    perfil: 'Administrador',
    professorId: '',
    permissoes: [],
    ativo: true,
  };
  const temporizador =
    caminhoBanco === ':memory:'
      ? undefined
      : setInterval(() => {
          if (acesso.instalado())
            void copias
              .automatico(sistema)
              .catch(() => console.error('Falha no backup automático. Consulte Configurações.'));
        }, 60000);
  temporizador?.unref();
  function transacao<T>(acao: () => T): T {
    banco.db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = acao();
      banco.db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      banco.db.exec('ROLLBACK');
      throw erro;
    }
  }
  const servidor = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const responder = (status: number, dados: unknown) => {
      res.writeHead(status);
      res.end(JSON.stringify(dados));
    };
    const arquivo = (conteudo: Uint8Array, nome: string, mime: string) => {
      res.setHeader('Content-Type', mime);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
      );
      res.end(conteudo);
    };
    const host = req.headers.host ?? '';
    const origem = req.headers.origin;
    if (
      !/^(localhost|127\.0\.0\.1):\d+$/.test(host) ||
      (origem && !/^http:\/\/(localhost|127\.0\.0\.1):(5173|4173|3001)$/.test(origem))
    ) {
      responder(403, { erro: 'Origem não permitida.' });
      return;
    }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const caminho = url.pathname;
      const metodo = req.method ?? 'GET';
      const cookie =
        (req.headers.cookie ?? '')
          .split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith('sessao='))
          ?.slice(7) ?? '';
      let corpo: Dados = {};
      if (!['GET', 'HEAD'].includes(metodo)) {
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json')
          throw new ErroCadastro('Envie os dados em JSON.', 415);
        const limite = caminho.endsWith('/anexo') ? 7200000 : 100000;
        const partes: Buffer[] = [];
        let tamanho = 0;
        for await (const parte of req) {
          tamanho += parte.length;
          if (tamanho > limite) {
            responder(413, { erro: 'Dados acima do limite permitido.' });
            return;
          }
          partes.push(parte);
        }
        corpo = objeto(JSON.parse(Buffer.concat(partes).toString('utf8')));
      }
      if (caminho === '/api/auth/estado' && metodo === 'GET') {
        responder(200, { instalado: acesso.instalado() });
        return;
      }
      if (caminho === '/api/auth/inicial' && metodo === 'POST') {
        responder(201, await acesso.configurar(corpo));
        return;
      }
      if (caminho === '/api/auth/entrar' && metodo === 'POST') {
        const resultado = await acesso.entrar(corpo, req.socket.remoteAddress ?? 'local');
        res.setHeader(
          'Set-Cookie',
          `sessao=${resultado.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,
        );
        responder(200, {
          ...resultado.usuario,
          sessaoMinutos: lerConfiguracoes(banco).sessaoMinutos,
        });
        return;
      }
      if (caminho === '/api/auth/recuperar' && metodo === 'POST') {
        responder(200, await acesso.recuperar(corpo, req.socket.remoteAddress ?? 'local'));
        return;
      }
      const publico = /^\/api\/compartilhados\/([a-f0-9-]+)$/.exec(caminho);
      if (publico && metodo === 'GET') {
        const link = banco.db.prepare('SELECT * FROM compartilhamentos WHERE id=?').get(publico[1]);
        if (!link || Date.now() - Date.parse(String(link.data)) > 7 * 86400000)
          throw new ErroCadastro('Link expirado ou inválido.', 404);
        const linha = banco.db
          .prepare('SELECT dados FROM registros WHERE id=? AND tipo=?')
          .get(String(link.materialId), 'materiais');
        if (!linha || JSON.parse(String(linha.dados)).status !== 'Ativo')
          throw new ErroCadastro('Material indisponível.', 404);
        const anexo = banco.db
          .prepare('SELECT * FROM anexos WHERE registroId=?')
          .get(String(link.materialId));
        if (anexo) arquivo(anexo.conteudo as Uint8Array, String(anexo.nome), String(anexo.mime));
        else {
          const material = JSON.parse(String(linha.dados));
          res.writeHead(302, { Location: material.link });
          res.end();
        }
        return;
      }
      const usuario = acesso.sessao(cookie, lerConfiguracoes(banco).sessaoMinutos);
      if (caminho === '/api/auth/eu' && metodo === 'GET') {
        responder(200, { ...usuario, sessaoMinutos: lerConfiguracoes(banco).sessaoMinutos });
        return;
      }
      if (caminho === '/api/auth/sair' && metodo === 'POST') {
        acesso.sair(cookie, usuario);
        res.setHeader('Set-Cookie', 'sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        responder(200, {});
        return;
      }
      if (caminho === '/api/referencias' && metodo === 'GET') {
        const ref = referencias(fontes, usuario);
        responder(200, {
          ...ref,
          pagamentos:
            usuario.perfil === 'Administrador' || usuario.permissoes.includes('financeiro')
              ? ref.pagamentos
              : [],
        });
        return;
      }
      if (caminho === '/api/usuarios' && metodo === 'GET') {
        permitir(usuario, 'seguranca', true);
        responder(200, acesso.listar());
        return;
      }
      if (caminho === '/api/usuarios' && metodo === 'POST') {
        responder(201, await acesso.criar(corpo, usuario));
        return;
      }
      const usuarioId = /^\/api\/usuarios\/([a-f0-9-]+)$/.exec(caminho)?.[1];
      if (usuarioId && metodo === 'PUT') {
        responder(200, acesso.editar(usuarioId, corpo, usuario));
        return;
      }
      const prof = /^\/api\/professores(?:\/([a-f0-9-]+)(\/status)?)?$/.exec(caminho);
      if (prof) {
        permitir(usuario, 'professores');
        const [, id, status] = prof;
        if (id && usuario.perfil !== 'Administrador' && usuario.professorId !== id)
          throw new ErroCadastro('Sem acesso a esse professor.', 403);
        if (metodo === 'GET' && !status) {
          responder(
            200,
            id
              ? professores.buscar(id)
              : professores
                  .listar()
                  .filter(
                    (p) => usuario.perfil === 'Administrador' || p.id === usuario.professorId,
                  ),
          );
          return;
        }
        if (!id && metodo === 'POST') {
          permitir(usuario, 'professores', true);
          responder(
            201,
            transacao(() => {
              const r = professores.criar(corpo);
              banco.evento(usuario, 'professores', 'Cadastro', r.id, { nome: r.nome });
              return r;
            }),
          );
          return;
        }
        if (id && metodo === 'PUT' && !status) {
          const antes = professores.buscar(id);
          if (
            usuario.perfil !== 'Administrador' &&
            (corpo.perfil !== antes.perfil || corpo.ativo !== antes.ativo)
          )
            throw new ErroCadastro('Somente o administrador altera perfil e status.', 403);
          responder(
            200,
            transacao(() => {
              const r = professores.editar(id, corpo);
              banco.evento(usuario, 'professores', 'Alteração', id, { antes, depois: r });
              return r;
            }),
          );
          return;
        }
        if (id && status && metodo === 'PATCH') {
          permitir(usuario, 'professores', true);
          responder(
            200,
            transacao(() => {
              const r = professores.alterarStatus(id, corpo);
              banco.evento(usuario, 'professores', 'Status alterado', id, { ativo: r.ativo });
              return r;
            }),
          );
          return;
        }
      }
      const rotas: Record<string, { modulo: string; validar: (d: Dados, id?: string) => Dados }> = {
        disciplinas: { modulo: 'disciplinas', validar: validarDisciplina },
        conteudos: {
          modulo: 'disciplinas',
          validar: (d, id) => validarConteudo(d, banco, usuario, id),
        },
        aprendizados: {
          modulo: 'disciplinas',
          validar: (d, id) => validarAprendizado(d, banco, usuario, fontes, id),
        },
        materiais: {
          modulo: 'materiais',
          validar: (d) => validarMaterial(d, banco, usuario, fontes),
        },
        avaliacoes: {
          modulo: 'avaliacoes',
          validar: (d) => validarAvaliacao(d, banco, usuario, fontes),
        },
        presencas: {
          modulo: 'presenca',
          validar: (d, id) => validarPresenca(d, banco, usuario, fontes, id),
        },
      };
      const registro = /^\/api\/registros\/([a-z]+)(?:\/([a-f0-9-]+))?$/.exec(caminho);
      if (registro && Object.hasOwn(rotas, registro[1])) {
        const [, tipo, id] = registro;
        const rota = rotas[tipo];
        const consultaRelacionada =
          metodo === 'GET' &&
          ['disciplinas', 'conteudos'].includes(tipo) &&
          usuario.permissoes.some((p) =>
            ['materiais', 'avaliacoes', 'presenca', 'relatorios'].includes(p),
          );
        if (!consultaRelacionada) permitir(usuario, rota.modulo);
        if (metodo === 'GET') {
          const resultados = banco
            .listar(tipo, usuario)
            .map((r) =>
              tipo === 'materiais'
                ? {
                    ...r,
                    anexo:
                      banco.db
                        .prepare(
                          'SELECT nome, length(conteudo) AS tamanho FROM anexos WHERE registroId=?',
                        )
                        .get(r.id) ?? null,
                  }
                : r,
            );
          responder(200, id ? banco.buscar(tipo, id, usuario) : resultados);
          return;
        }
        if ((!id && metodo === 'POST') || (id && metodo === 'PUT')) {
          responder(
            id ? 200 : 201,
            transacao(() =>
              banco.salvar(
                tipo,
                rota.validar(objeto(corpo.dados), id),
                usuario,
                id,
                Number(corpo.versao),
              ),
            ),
          );
          return;
        }
      }
      const material =
        /^\/api\/materiais\/([a-f0-9-]+)\/(anexo|compartilhar|compartilhamentos)$/.exec(caminho);
      if (material) {
        permitir(usuario, 'materiais');
        const [, id, acao] = material;
        banco.buscar('materiais', id, usuario);
        if (acao === 'anexo' && metodo === 'POST') {
          responder(
            200,
            transacao(() => guardarAnexo(banco, usuario, id, corpo)),
          );
          return;
        }
        if (acao === 'anexo' && metodo === 'GET') {
          const anexo = banco.db.prepare('SELECT * FROM anexos WHERE registroId=?').get(id);
          if (!anexo) throw new ErroCadastro('Sem arquivo anexado.', 404);
          arquivo(anexo.conteudo as Uint8Array, String(anexo.nome), String(anexo.mime));
          return;
        }
        if (acao === 'compartilhar' && metodo === 'POST') {
          responder(
            201,
            transacao(() => compartilharMaterial(banco, usuario, id, corpo, fontes)),
          );
          return;
        }
        if (acao === 'compartilhamentos' && metodo === 'GET') {
          responder(
            200,
            banco.db
              .prepare(
                'SELECT alunoId,destinatario,data FROM compartilhamentos WHERE materialId=? ORDER BY data DESC',
              )
              .all(id),
          );
          return;
        }
      }
      if (caminho === '/api/configuracoes') {
        permitir(usuario, 'configuracoes', true);
        if (metodo === 'GET') {
          responder(200, lerConfiguracoes(banco));
          return;
        }
        if (metodo === 'PUT') {
          responder(
            200,
            transacao(() => salvarConfiguracoes(banco, usuario, corpo)),
          );
          return;
        }
      }
      if (caminho === '/api/backups') {
        permitir(usuario, 'configuracoes', true);
        if (metodo === 'GET') {
          responder(200, { arquivos: copias.listar(), erro: copias.falha() });
          return;
        }
        if (metodo === 'POST') {
          responder(201, await copias.criar(usuario));
          return;
        }
      }
      const copia = /^\/api\/backups\/(backup-[\dT-]+\.sqlite)$/.exec(caminho);
      if (copia && metodo === 'GET') {
        permitir(usuario, 'configuracoes', true);
        if (!copias.listar().some((a) => a.nome === copia[1]))
          throw new ErroCadastro('Backup não encontrado.', 404);
        banco.evento(usuario, 'configuracoes', 'Backup baixado', copia[1]);
        arquivo(readFileSync(join(pasta, copia[1])), copia[1], 'application/octet-stream');
        return;
      }
      if (caminho === '/api/historico' && metodo === 'GET') {
        permitir(usuario, 'historico');
        responder(200, consultarHistorico(banco, usuario, url.searchParams));
        return;
      }
      if (['/api/relatorios', '/api/relatorios/pdf'].includes(caminho) && metodo === 'GET') {
        permitir(usuario, 'relatorios');
        const relatorio = gerarRelatorio(banco, usuario, fontes, url.searchParams);
        if (caminho.endsWith('/pdf')) {
          const pdf = await gerarPdf(relatorio);
          banco.evento(usuario, 'relatorios', 'PDF exportado', '', {
            tipo: url.searchParams.get('tipo'),
          });
          arquivo(pdf, 'relatorio.pdf', 'application/pdf');
        } else responder(200, relatorio);
        return;
      }
      throw new ErroCadastro('Rota não encontrada.', 404);
    } catch (erro) {
      if (erro instanceof ErroCadastro) responder(erro.status, { erro: erro.message });
      else if (erro instanceof SyntaxError) responder(400, { erro: 'JSON inválido.' });
      else {
        console.error('Erro interno:', erro instanceof Error ? erro.message : 'desconhecido');
        responder(500, { erro: 'Não foi possível concluir a operação.' });
      }
    }
  });
  servidor.on('close', () => {
    if (temporizador) clearInterval(temporizador);
    banco.fechar();
  });
  return servidor;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pasta = new URL('../dados/', import.meta.url);
  mkdirSync(pasta, { recursive: true });
  const servidor = criarServidor(fileURLToPath(new URL('educonnect.sqlite', pasta)));
  servidor.on('error', (erro) => {
    console.error('Não foi possível iniciar o backend:', erro.message);
    process.exitCode = 1;
  });
  servidor.listen(3001, '127.0.0.1', () => console.log('Backend: http://127.0.0.1:3001'));
  process.on('SIGINT', () => servidor.close());
  process.on('SIGTERM', () => servidor.close());
}
