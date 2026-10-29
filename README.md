# NEXOCENA STUDIO

Da narrativa à imagem. Da imagem ao filme.

Site React/Vite responsivo para computador e celular. Backend Node 24/Fastify, **PostgreSQL no schema privado Supabase e mídias no Supabase Storage privado em produção**. SQLite/disco local ficam somente para testes/desenvolvimento e leitura de legado em manutenção. Não há Android nativo, Capacitor ou APK.

Branch de migração: `develop/free-hosting-supabase`. Veja [guia Free](docs/FREE_HOSTING_SUPABASE.md) e [relatório da entrega](docs/FREE_HOSTING_REPORT.md). Os relatórios anteriores descrevem a arquitetura histórica e não devem orientar o novo deploy.

## Desenvolvimento e validação

Na raiz do checkout existente, Node 24:

```sh
npm ci
ACCESS_MODE=multiuser REGISTRATION_ENABLED=true npm run dev
npm run typecheck
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

API 3001 e Vite 5173. O proxy do Vite só existe em desenvolvimento. Cadastros públicos precisam do opt-in acima; produção usa proprietário privado. Testes PostgreSQL são explicitamente skipped sem TEST_DATABASE_URL; o CI provisiona um banco descartável e os executa de verdade. Nunca aponte testes ao banco de produção. Para executar todos localmente, siga o guia de banco isolado.

`npm run build` compila API/CLIs e frontend. Render: `npm ci && npm run build:api`; start: `npm run start:api`. Nenhuma migration é aplicada no boot. Execute `npm run db:migrate` primeiro, com ambiente seguro, após backup e aprovação.

## Funcionalidades

Login/logout privado, sessões persistidas, projetos, roteiro, cenas, revisão otimista, AutoSave, restauração do projeto ativo, biblioteca privada, upload até 50 MB, reprodução/download, exclusão protegida, aprovação e exportação JSON/prompts. Remoção de projeto é lógica para preservar histórico e referências de tarefas. Mídias usadas por projetos/histórico não são apagadas.

O módulo Runway permanece no código e sua persistência foi migrada. **A implantação gratuita bloqueia geração paga**, mesmo se alguém tentar chamar os endpoints diretamente. Não configure chave ou cobrança Runway. Compilação FFmpeg de montagem continua indisponível.

## Supabase, Render e Vercel

- PostgreSQL: variável secreta DATABASE_URL, TLS verificado, pool padrão 2, SQL parametrizado e schema não exposto ao navegador.
- Storage: SUPABASE_URL, SUPABASE_SECRET_KEY somente backend e bucket privado nexocena-media; não há Blob URLs como armazenamento principal.
- Vercel: o build `npm run build:vercel` gera Build Output API com rewrite /api para API_ORIGIN e fallback SPA. **Requer a URL real Render e não usa o antigo Output Directory apps/web/dist no deploy Vercel.** Veja o guia antes de mudar as configurações do projeto existente.
- Render: blueprint `render.yaml` preparado para Free sem disco e com auto-deploy desativado. Não foi aplicado por esta entrega.

Scripts de manutenção: `db:migrate`, `create:owner` (senha stdin; --reset explícito revoga sessões sem mudar o ID), `storage:reconcile` (intenções órfãs com mais de 24h), `db:import-legacy` (somente plano sem --apply). Nenhum script insere senha administrativa fixa. `backup` SQLite é apenas legado local; produção exige backup PostgreSQL e objetos remotos.

Não é uma implantação validada: credenciais/acesso real Supabase, URL/serviço Render e publicação final Vercel ainda dependem do proprietário. Não foram contratados planos pagos, feitas chamadas pagas Runway ou alterada a main.
