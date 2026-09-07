# EduConnect

React, TypeScript e Vite no front; Node.js e SQLite no backend. Requer Node.js 24 ou superior e npm. Não precisa instalar um banco separado.

## Rodar

Na pasta do projeto, instale as dependências:

```bash
npm ci
```

Inicie o backend:

```bash
npm run servidor
```

Em outro terminal, inicie o front:

```bash
npm run dev
```

Acesse http://127.0.0.1:5173. O backend usa a porta 3001. No primeiro acesso, crie o administrador e guarde o código de recuperação de senha.

## Testar

- Cadastre e edite um professor, uma disciplina, um conteúdo e um material. Confira as alterações no Histórico.
- Teste anexos em Materiais, usuários e permissões em Segurança e backup em Configurações.
- Os módulos 1–8 ainda são placeholders. Avaliações, presença e relatórios por aluno dependem da integração de alunos, aulas e pagamentos em `src/integracao.ts`.

Para verificar os tipos e gerar o build do front:

```bash
npm run build
```

Os dados ficam em `dados/educonnect.sqlite` e os backups em `dados/backups/`, fora do Git. Encerre os servidores com `Ctrl+C`. Se aparecer `EADDRINUSE`, encerre a instância anterior que está usando a porta.

## Estrutura

```text
educonnect/
├── public/
│   ├── api.ts
│   ├── App.tsx
│   ├── Avaliacoes.tsx
│   ├── Cadastro.tsx
│   ├── Configuracoes.tsx
│   ├── Disciplinas.tsx
│   ├── Historico.tsx
│   ├── index.html
│   ├── main.tsx
│   ├── Materiais.tsx
│   ├── Presenca.tsx
│   ├── Professores.tsx
│   ├── Relatorios.tsx
│   ├── Seguranca.tsx
│   └── styles.css
├── src/
│   ├── modulos/
│   │   ├── Acompanhamento.tsx
│   │   ├── Agendamento.tsx
│   │   ├── Alunos.tsx
│   │   ├── AreaProfessor.tsx
│   │   ├── Avaliacoes.ts
│   │   ├── Comunicacao.tsx
│   │   ├── Configuracoes.ts
│   │   ├── Dashboard.tsx
│   │   ├── Disciplinas.ts
│   │   ├── Historico.ts
│   │   ├── Materiais.ts
│   │   ├── Pagamentos.tsx
│   │   ├── Planejamento.tsx
│   │   ├── Presenca.ts
│   │   ├── Professores.ts
│   │   ├── Relatorios.ts
│   │   └── Seguranca.ts
│   ├── banco.ts
│   ├── integracao.ts
│   └── servidor.ts
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```
