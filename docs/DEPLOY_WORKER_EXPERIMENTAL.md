# Pacote de implantação — NEXOCENA API experimental

Este procedimento **não publica automaticamente** nem altera a branch `main`.

## Compilar

Depois de `npm ci`, execute `node scripts/build-cloudflare-worker.mjs`.
O pacote ESM fica em `dist/worker/nexocena-api-experimental.mjs`, com SHA-256 no arquivo `.sha256`.

O GitHub Actions cria um artefato de download `nexocena-worker-experimental` que contém esse pacote. **Nunca** copie apenas `apps/worker/src/index.ts` ao editor Cloudflare: ele usa módulos TypeScript e dependências.

## Estado atual da infraestrutura

- Worker existente: `nexocena-api-experimental.mkprod-60.workers.dev`
- Banco D1 experimental: `nexocena-experimental`
- Vínculo D1: `DB`
- Migrações 0001–0004 foram aplicadas manualmente no painel. O registro `d1_migrations` do Wrangler pode não existir, então **não** aplicar automaticamente as mesmas migrações outra vez.

## Segurança e implantação

- O pacote compilado **não contém** tokens, senhas nem configurações reais de autenticação.
- `EXPERIMENT_REMOTE_ENABLED` deve permanecer ausente até que a autenticação seja homologada. O endpoint `/api/health` é público, e o restante retorna 503 enquanto o flag estiver desligado.
- Para criar a conta proprietária, configure `EXPERIMENT_OWNER_EMAIL`, `EXPERIMENT_SETUP_TOKEN_HASH` e só temporariamente `EXPERIMENT_REGISTRATION=true`. Não publique o convite em repositórios ou logs.
- O segredo de convite precisa ser aleatório, secreto e restrito à instalação; o valor de teste dos arquivos locais **não** pode ser reutilizado remotamente.
- A compilação do Worker não implica compatibilidade comprovada com limite de CPU do Workers Free: o PBKDF2 deve ser testado remotamente antes de abrir login/cadastro.
- **Não publicar** apenas porque o pacote existe: conferir a CI, bindings, versão anterior e opção de rollback. Se usar o editor web, salvar o código anterior antes de substituir.
- O frontend Vercel permanece com o modo DEMO e não está conectado à API. Será necessário um proxy seguro `/api` de mesma origem com cookies preservados, antes de usar projetos reais.
- Uploads, MP4, mídia persistente e recuperação de senha ainda não estão homologados. Não informar aos usuários que são recursos disponíveis.

## Bloqueio de administração no ChatGPT

A conexão Cloudflare atual pode identificar a conta, mas as operações de leitura de Workers e D1 retornaram negação de escopo. Para implantar usando o conector, reconectar autorizando **Workers Editor/Workers Scripts Write** e **D1 Read**. Só adicionar permissões de escrita no D1 se uma operação exigir e se estiver explicitamente autorizada. Nunca enviar token ao chat.
