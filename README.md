# Sistema de Gestão de Acolhimento Hospitalar

Sistema web para gestão e acompanhamento operacional/gerencial dos setores
**SEREC, SUAC, SETIP e SEPPERT** — cadastros, indicadores, dashboards com
gráficos interativos, filtros de período, atualização automática a cada 30
segundos, controle de permissões, auditoria e exportação de relatórios.

> **Sobre esta entrega:** este é o **MVP funcional** da arquitetura completa
> descrita no escopo original. A base (banco de dados, autenticação, RBAC,
> layout responsivo, dark mode, auditoria, CRUDs, dashboards, polling de 30s)
> está pronta e funcionando de ponta a ponta com **3 indicadores completos**
> (SEREC · Pacientes Atendidos, SUAC · Feedbacks e SUAC · Patrimônios). Os
> demais indicadores do documento original (Entradas, Atendimentos por
> usuário, Tempo de Atendimento, Erros Operacionais, Transporte de Pacientes,
> Treinamentos, Ouvidorias, Central de Pertences etc.) aparecem na navegação
> como "módulo em construção" — a arquitetura (banco, rotas, componentes) foi
> desenhada para que cada um seja adicionado seguindo exatamente o mesmo
> padrão dos três já implementados. Veja "Como adicionar um novo indicador"
> abaixo.

## Stack

- **Front-end:** React 19 + TypeScript + Vite, Tailwind CSS v4, Recharts, React Router.
- **Back-end:** Node.js + Express + TypeScript.
- **Banco de dados:** SQLite (via `better-sqlite3`) — schema relacional normalizado,
  pronto para ser portado para PostgreSQL (as queries usam SQL padrão).
- **Autenticação:** JWT + bcrypt, com rate limiting básico no login.
- **Autorização:** RBAC (administrador / gestor / operacional), validado no back-end
  em toda rota sensível (nunca apenas no front-end).

## Estrutura do projeto

```
acolhimento/
  server/            API REST (Express + TypeScript + SQLite)
    src/
      db/            schema.sql, connection.ts, seed.ts (dados de demonstração)
      middleware/     auth.ts (JWT + RBAC)
      routes/         auth, users, profile, collaborators, managers, assets,
                       serecPatients, feedbacks, audit, dashboard, demo
      utils/          crudFactory.ts (fábrica de rotas CRUD com auditoria automática)
  client/            SPA (React + TypeScript + Vite + Tailwind)
    src/
      components/     layout (sidebar/topbar), ui (Card, Modal, DataTable, etc.),
                       charts (Recharts, paleta validada para acessibilidade)
      contexts/       Auth, Theme, Toast, PageHeader (título + polling do topo)
      pages/          Login, Dashboard, SEREC, SUAC, Colaboradores, Gestores,
                       Patrimônios, Usuários, Relatórios, Auditoria, Perfil, Configurações
      hooks/          usePolling.ts (atualização automática a cada 30s)
```

## Como rodar localmente

Pré-requisitos: Node.js 18+ e npm.

### 1. Back-end

```bash
cd server
npm install
npm run seed   # cria o banco SQLite em server/data/ e popula com dados de demonstração
npm run dev    # inicia a API em http://localhost:4000
```

### 2. Front-end (em outro terminal)

```bash
cd client
npm install
npm run dev    # inicia em http://localhost:5173 (proxy configurado para /api -> :4000)
```

Acesse `http://localhost:5173`.

### Rodar em produção (um único serviço)

Para hospedar (Railway, Render, um VPS etc.), o Express também sabe servir o
front-end já compilado — não precisa de dois serviços separados:

```bash
npm run install:all   # instala client e server
npm run build         # compila o client (Vite) e o server (tsc)
npm run seed           # popula o banco (idempotente, pode rodar sempre)
npm start               # sobe tudo em http://localhost:4000 (ou na porta definida em $PORT)
```

Veja `RAILWAY_DEPLOY.md` para o passo a passo específico de deploy no Railway
(já inclui `railway.json` pronto).

### Login de demonstração

| Usuário       | Senha         | Perfil        |
|---------------|---------------|---------------|
| `admin`       | `Acolher@123` | Administrador |
| `ana.souza`   | `Acolher@123` | Gestor        |
| `carlos.lima` | `Acolher@123` | Operacional   |

## Dados de demonstração

O `npm run seed` gera ~90 dias de lançamentos fictícios de pacientes atendidos
(SEREC), feedbacks (SUAC), além de colaboradores, gestores e patrimônios de
exemplo — o suficiente para todos os gráficos e dashboards funcionarem com
dados reais do banco (nada é mockado no front-end). Nenhum dado real de
paciente é utilizado.

Um administrador pode remover todos os dados de demonstração a qualquer
momento em **Configurações → Limpar dados de demonstração** (usuários e
auditoria são preservados).

## O que já funciona de ponta a ponta

- Login com JWT, "mostrar/ocultar senha", "esqueci minha senha" (fluxo simulado),
  rate limiting básico contra força bruta.
- RBAC real: 3 perfis (administrador, gestor, operacional), validado no
  back-end em cada rota — nunca apenas escondendo botões no front-end.
- Sidebar responsiva: retrátil no desktop, com overlay em tela cheia no mobile
  (abre com hambúrguer, fecha ao clicar fora ou ao navegar).
- Modo claro / escuro / automático (segue o sistema operacional), com
  paleta de cores validada para acessibilidade (contraste e daltonismo).
- Dashboard geral e dashboards por indicador com cards KPI, gráficos de
  linha/barra/pizza interativos (tooltip, legenda, filtro de período).
- Atualização automática a cada 30 segundos (sem recarregar a página) +
  botão "Atualizar agora" + indicador "Última atualização: HH:MM:SS".
- Filtros de período: hoje, ontem, últimos 7/30 dias, este mês, mês anterior,
  este ano, período personalizado.
- CRUD completo (criar/editar/excluir com confirmação) para: Pacientes
  atendidos (SEREC), Feedbacks (SUAC), Patrimônios, Colaboradores, Gestores
  e Usuários — todas as tabelas com busca, paginação e exportação CSV.
- Auditoria: toda ação de login, criação, alteração e exclusão é registrada
  com usuário responsável, timestamp e diff (dado anterior / novo).
- Perfil do usuário: editar dados, trocar foto (upload real), alterar senha,
  excluir conta (com confirmação em duas etapas + senha atual). A exclusão
  desativa a conta e preserva o histórico de lançamentos vinculado a ela.
- Relatórios: geração e exportação CSV respeitando os filtros aplicados.

## Como adicionar um novo indicador (padrão a seguir)

Cada indicador segue o mesmo padrão fim-a-fim já usado em "SEREC · Pacientes
Atendidos" (`server/src/routes/serecPatients.ts` e
`client/src/pages/serec/SerecPatients.tsx`):

1. **Banco:** adicionar a tabela em `server/src/db/schema.sql` (com `created_by`,
   `created_at`, `updated_at`).
2. **API:** criar a rota com `buildCrudRouter` (`server/src/utils/crudFactory.ts`)
   — já inclui paginação, busca, auditoria automática e RBAC — e um endpoint
   `/agg/summary` para os agregados do dashboard.
3. **Front-end:** criar a página reaproveitando `PeriodFilter`, `KpiCard`,
   `DataTable`, `Modal`/`ConfirmDialog` e os componentes de gráfico em
   `components/charts/Charts.tsx`.
4. **Navegação:** adicionar a aba na página do setor correspondente
   (`SerecPage.tsx`, `SuacPage.tsx` etc.) no lugar do `EmptyState` de
   "módulo em construção".

## Segurança

- Senhas com hash bcrypt (nunca texto puro).
- JWT assinado com segredo em `.env` (**troque `JWT_SECRET` antes de usar em produção**).
- Todas as rotas de escrita exigem token válido; ações sensíveis exigem o
  perfil correto — validado no back-end.
- Rate limiting simples no login (8 tentativas / 5 min por usuário).
- `express.json` com limite de tamanho; upload de foto limitado a 3MB e
  restrito a tipos de imagem.

## Próximos passos sugeridos

- Migrar de SQLite para PostgreSQL para ambientes multi-usuário de produção
  (as queries já usam SQL padrão; principais mudanças seriam o driver e a
  sintaxe de auto-increment/timestamps).
- Implementar os indicadores restantes seguindo o padrão acima.
- WebSocket/SSE para atualização em tempo real complementando o polling de 30s.
- Exportação em Excel/PDF (hoje disponível em CSV).
- Testes automatizados (unitários no back-end, E2E no front-end).
