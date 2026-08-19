# Deploy no Railway (passo a passo)

O projeto já está preparado para subir como **um único serviço** no Railway
(o Express serve a API em `/api/*` e também os arquivos estáticos do React
já compilado). Não precisa configurar dois serviços nem proxy.

## Opção A — Pelo site do Railway (mais simples, sem instalar nada)

1. Suba a pasta `acolhimento/` (o conteúdo deste zip) para um repositório no
   seu GitHub (crie um repo novo e faça push, ou use "Upload files" direto
   pelo GitHub).
2. Em [railway.app](https://railway.app), clique em **New Project → Deploy
   from GitHub repo** e selecione o repositório.
3. O Railway detecta automaticamente o `railway.json` na raiz e usa:
   - **Build:** `npm run build` (instala e compila o client, depois o server)
   - **Start:** `npm run seed && npm start` (popula dados de demonstração na
     primeira vez — nas próximas o seed não duplica nada, pois é idempotente)
4. Em **Settings → Networking**, clique em **Generate Domain**. Em 1-2
   minutos você recebe uma URL pública tipo `https://seu-app.up.railway.app`.
5. (Opcional, recomendado) Em **Variables**, defina `JWT_SECRET` com um valor
   novo e aleatório (troque o valor padrão do `.env` antes de ir para
   produção).

## Opção B — Pelo terminal (Railway CLI), com o token que você já tem

```bash
npm install -g @railway/cli
railway login              # ou: railway login --browserless, se preferir colar o token
cd acolhimento
railway init                # cria um novo projeto Railway
railway up                  # builda e faz o deploy usando o railway.json
railway domain              # gera e mostra a URL pública
```

Se preferir usar diretamente um **token de projeto** (sem `railway login`
interativo), exporte a variável de ambiente antes do `railway up`:

```bash
export RAILWAY_TOKEN=seu_token_aqui
railway up
```

## Persistência dos dados (importante)

O banco (SQLite) e as fotos de perfil ficam em `server/data/` e
`server/uploads/`. No plano gratuito do Railway, o sistema de arquivos é
efêmero em alguns tipos de redeploy — ou seja, os dados cadastrados podem
resetar quando você fizer um novo deploy. Para persistir de verdade:

- Adicione um **Volume** no Railway (Settings → Volumes) montado em
  `/app/server/data` (e outro em `/app/server/uploads`, se for usar fotos de
  perfil); ou
- Migre para PostgreSQL (recomendado para uso real/multi-usuário — o README
  principal já indica o caminho).

## Variáveis de ambiente no Railway

| Variável | Valor sugerido |
|---|---|
| `JWT_SECRET` | uma string aleatória longa (troque o valor padrão!) |
| `JWT_EXPIRES_IN` | `8h` (ou o que preferir) |
| `PORT` | não precisa definir — o Railway injeta automaticamente e o servidor já usa `process.env.PORT` |
| `DB_PATH` | `./data/acolhimento.db` (padrão já funciona) |

Depois do deploy, acesse a URL gerada e entre com `admin` / `Acolher@123`
(troque a senha depois, em produção).
