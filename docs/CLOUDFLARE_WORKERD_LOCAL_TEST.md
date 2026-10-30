# Migração experimental Cloudflare — validação Workerd

Status: **somente desenvolvimento local**. Sem deploy, sem Cloudflare remoto, sem dados reais e sem alteração na produção.

## Testes do runtime

O comando `npm run test:workerd` realiza estas ações:
1. Baixa temporariamente a versão `wrangler@4.155.0` via npx, sem alterar package-lock ou instalar na Cloudflare.
2. Cria banco D1 **somente local**, dentro de um diretório temporário.
3. Aplica `0001_initial.sql`, `0002_auth.sql` e `0003_auth_throttles.sql` exclusivamente com `--local`.
4. Inicia o runtime Workerd local em 127.0.0.1:8789.
5. Testa cadastro, login, sessão, CSRF, projetos, controle de revisão, créditos e logout.
6. Encerra o processo e remove os dados temporários.

O teste registra latência de parede (*wall-clock*) de cadastro/login, que **não equivale ao consumo de CPU faturado/limitado pela Cloudflare**.

## Como executar

Com Node.js 24 e checkout desta branch:

```bash
npm ci
npm run typecheck:worker
npm run test:worker
npm run test:workerd
npm run build
```

Para desenvolver a interface manualmente sem integrar com produção:

1. Copie `apps/web/.env.local.example` para `apps/web/.env.local` (arquivo privado ignorado pelo Git).
2. Configure localmente o D1 usando `apps/worker/wrangler.local.jsonc`, sempre com `--local`.
3. Execute `npx --yes wrangler@4.155.0 dev --local --config apps/worker/wrangler.local.jsonc --port 8789`.
4. Em outro terminal, rode `npm run dev -w apps/web`; a interface Vite usa `API_TARGET=http://127.0.0.1:8789`.
5. Use somente `owner@example.com` e uma senha descartável; estas credenciais são de **teste local**.

A aplicação não deve ser iniciada com `wrangler.jsonc` de produção enquanto os bindings são placeholders.

## Android e mídias

O flag `VITE_NEXOCENA_EXPERIMENTAL=true` exibe aviso de ambiente experimental, bloqueia controles de upload/aprovação e oculta geração via provedor pago. Exportação JSON de projetos disponível; não envia MP4, imagens ou narração para D1.

Não há armazenamento de mídias na nuvem, importação de backup JSON automático, MP4 nem migração de contas. Não anunciar plataforma completa.

## Portas de homologação

- Conferir GitHub Actions e logs do runtime Workerd real.
- Medir CPU em um cenário representativo de Workers Free (não inferir CPU pelo wall-clock local).
- Homologar backup/restauração, Android, registros, bloqueios de conta e restrição de origens.
- Desativar integração com provedores pagos e não criar R2/Workers remotos antes de autorização específica.

O fluxo local não deve fazer `wrangler deploy`, `d1 create` nem `d1 migrations apply --remote`.
