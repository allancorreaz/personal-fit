# Personal Fit

SaaS para personal trainers: alunos, fichas de treino, registro de treino pelo aluno,
avaliação física com fotos, anamnese e cobranças com Pix automático (Mercado Pago de cada personal).

- **Web + PWA** (Next.js 16, App Router) — instala na tela inicial do celular.
- **App de loja** com Capacitor (`capacitor.config.ts`) usando o mesmo código.
- **Banco**: Supabase (Postgres + RLS multi-personal + Storage privado + Vault).

## Segurança (resumo)
- Cada linha tem `personal_id`; o RLS só mostra os dados do próprio personal. Chaves compostas
  `(personal_id, id)` impedem ligar registros entre personais.
- Colunas sensíveis (plano da plataforma, vínculo do login, campos do Pix) não podem ser alteradas pela API.
- Token do Mercado Pago de cada personal fica no **Vault**; só o servidor lê (função liberada para `service_role`).
- Webhook por personal com assinatura + reconsulta na API (dupla verificação).
- Fotos e vídeos em buckets **privados**, servidos por links temporários.
- Service worker não guarda páginas nem dados — só arquivos estáticos.

## Rodar
```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```
Migrations em `supabase/migrations` (aplicar em ordem).

## Gerar o app nativo
```bash
npx cap add android && npx cap sync && npx cap open android
```
