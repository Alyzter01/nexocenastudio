# Relatório — migração PostgreSQL/Supabase e preparação Free

**Entrega de código validada localmente; implantação real BLOQUEADA. Não é uma implantação concluída.** Critérios que dependem do Supabase/Render/Vercel reais continuam pendentes. Nenhum merge ou publicação final foi executado.

Branch exclusiva: develop/free-hosting-supabase. Base inspecionada: d34b2216a1acabbf40dd4cae5f1c140a45c019cc. A branch continha a migration inicial, o adaptador Storage e seus testes; o checkout anterior não os integrava. O conteúdo existente foi preservado e ampliado, sem recriação do projeto.

## Classificação por etapa

| Etapa | Estado e escopo verificável |
| --- | --- |
| Auditoria de rotas, SQLite, filesystem e módulos | CONCLUÍDA E TESTADA por inspeção e regressões locais |
| Driver pg/pool/TLS, SQL parametrizado e transações | CONCLUÍDA E TESTADA com PostgreSQL 17 real descartável; TLS do Supabase real não testado |
| Sessões/projetos/versões/revisões e concorrência | CONCLUÍDA E TESTADA com PostgreSQL real local, inclusive reinício e rollback |
| Persistência das tarefas/reserva/deduplicação | CONCLUÍDA E TESTADA com PostgreSQL real e provedor de vídeo explicitamente simulado |
| Rotas de mídias e compensação DB/objetos | CONCLUÍDA E TESTADA com PostgreSQL real e double de Storage; HTTP Supabase testado com fetch simulado |
| Provisionamento e reset do proprietário | CONCLUÍDA E TESTADA somente com contas de fixture em bancos isolados; conta real não criada/resetada |
| Importador legado read-only/empty-target | CONCLUÍDA E TESTADA entre SQLite e PostgreSQL locais, com mídia de fixture; dados reais não migrados |
| Migrations no Supabase kdwtbefpbcyendvtuufb | BLOQUEADA por ausência de DATABASE_URL e acesso de rede; não executadas nesta conta |
| Bucket real nexocena-media, permissões/cotas | BLOQUEADA por ausência de SUPABASE_SECRET_KEY; estado remoto não consultado |
| Render Free blueprint, Node 24 e start | IMPLEMENTADA, MAS NÃO TESTADA no provedor; serviço/URL não foram criados ou confirmados |
| Vercel Build Output API/rewrite | CONCLUÍDA E TESTADA como geração/build local; IMPLEMENTADA, MAS NÃO TESTADA como deployment Vercel |
| Frontend comunicando com PostgreSQL via API | CONCLUÍDA E TESTADA localmente no Chromium desktop e Android emulado; Storage de E2E local, não Supabase real |
| Publicação final no domínio existente | PENDENTE de homologação real e autorização explícita; produção não modificada |
| GitHub Actions remoto | PENDENTE de consulta/execução remota; workflow preparado com PostgreSQL descartável |

## Auditoria inicial e arquitetura resultante

Antes: server.ts, generation.ts e create-user.ts usavam DatabaseSync diretamente; upload/download/importação geravam arquivos no disco. Backup copiava SQLite e mídias. Apenas o Vite tinha proxy /api de desenvolvimento, inexistente no frontend estático. As migrations/Storage adicionadas não eram usadas pelas rotas.

Agora: database.ts fornece operações assíncronas e transações dedicadas; pg usa pool de 2 conexões por padrão (máximo configurável 5), timeout, TLS rejectUnauthorized e schema nexocena_private qualificado. Não usa prepared statements nomeados nem search_path variável, para compatibilidade com pooler. JSONB é normalizado no adaptador para manter o contrato existente, datas viram ISO e BIGINTs usados como contagem/ms viram números seguros neste domínio. Não há SQL montado com valores de requisição. Identificadores dinâmicos em manutenção são de listas estáticas.

Produção recusa DATABASE_URL ausente e Storage local. DatabaseSync só é importado dinamicamente no modo local; scripts legados usam SQLite somente em desenvolvimento, testes, backup local ou leitura de origem durante manutenção. O diretório de teste PG foi verificado como não criado quando banco/storage eram remotos por injeção. Não se usa disco temporário Render para persistência.

Projetos e versões são gravados na mesma transação. Locks de mídia impedem exclusão concorrente com associação de cena. Revisão otimista usa WHERE revision e testa duas atualizações concorrentes (uma 200, uma 409). Reserva de geração usa advisory lock transacional global antes do saldo e deduplicação. API paga fica bloqueada incondicionalmente em production desta configuração Free, inclusive com provider injetado como configurado; flag false e teto zero são exigidos no startup. Polling usa claim persistido e não consulta Runway na produção Free. Reinício trata SUBMITTING como UNKNOWN sem reenvio.

As FKs da migration inicial impediam apagar projetos com auditoria de geração. A migration tombstones adiciona deleted_at sem apagar dados: DELETE mantém 204 e remove o projeto da lista, preservando tarefas, versões, reservas e mídias. A UI descreve a retenção. Mídias referenciadas em projetos ou histórico são protegidas contra exclusão física.

## Mapa de rotas e autorização

- GET /api/health: público mínimo, DB e bucket consultados; 200 ready ou 503 degraded, sem URL/key.
- GET /api/auth/config: privado/registro habilitado, sem segredos.
- POST /api/auth/:action: login/logout/register; cadastro 403 em privado, rate limit, hashes/sessões no PostgreSQL.
- GET /api/me; GET/POST /api/projects; PUT/DELETE /api/projects/:id: sessão e proprietário, revisão e transações.
- GET/POST /api/media; GET/DELETE /api/media/:id: propriedade no banco antes de leitura/deleção, UUID de objeto, validação e proteção de referências.
- GET /api/video/provider; POST /api/video/quotes/jobs; GET /api/video/jobs e /:id; POST /:id/import: sessão/propriedade. Quotes/jobs pagos 503 em produção Free. Importar resultado previamente existente não inicia geração.

Middleware usa cookie HttpOnly/Secure/SameSite=Lax, origem exata e cabeçalho x-nexocena obrigatório em mutações; não abre CORS. Preview pode ser autorizada por lista exata de origens. Senhas/reset só em stdin no CLI; reset preserva ID e revoga sessões. Não há senha fixa, owner bootstrap HTTP ou chave no bundle.

## Storage e falhas parciais

MIME + assinatura de PNG/JPEG/MP4/WebM/MP3/WAV/Ogg; máximo 50 MB; um upload simultâneo por instância. Upload usa corpo limitado em memória; download é stream autenticado com Range encaminhado. ID UUID separado de nome de arquivo evita traversal. Headers externos encaminhados são apenas comprimento/range; URL assinada/segredos não são retornados.

Foi corrigida uma divergência comprovada no adaptador inicial: exclusão Supabase usa DELETE /storage/v1/object/{bucket} com JSON prefixes, conforme https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts. POST de upload e GET de download usam objeto privado. Redirects bloqueados em todas as chamadas; apikey e suporte à secret key moderna ficam apenas no servidor. Bucket público é recusado na verificação de saúde/startup.

storage_cleanup registra intenção antes de PUT remoto. Confirmar metadados e remover intenção é uma transação. Erro/timeout não é tratado como certeza de falha: metadados são relidos antes de compensar; banco indisponível mantém objeto para reconciliação em vez de apagar dados possivelmente confirmados. DELETE retira metadados/acesso e, se Storage falhar, responde 202 com limpeza pendente. Reconciliador processa até 100 intenções antigas (>24h), sob lock, só exclui objeto sem metadados; idempotente para objeto já removido. O teste confirma que não limpa intenção recente e limpa órfão antigo. Não foi executado contra seu bucket real.

Assinatura não equivale a antivírus/validação completa de codec. DNS/allowlist da importação Runway continuam com risco de rebinding dependente de egress controlado, como documentado na auditoria anterior. Geração paga não está habilitada para explorar esse fluxo.

## Migrations e dados preservados

Arquivos: inicial fornecida; 20261029_nexocena_private_storage_cleanup.sql; 20261029_nexocena_private_tombstones.sql. Executados somente em PostgreSQL local descartável, repetidos com sucesso. A primeira tentativa local falhou por ordem lexical de um nome provisório incremental antes da inicial; a transação foi revertida. O nome foi corrigido, a ordem final foi verificada e a repetição idempotente passou. Nenhuma migration foi aplicada pela entrega no Supabase real. O comentário na migration inicial de que foi aplicada anteriormente é informação fornecida, não verificação independente.

Importador de legado faz snapshot SQLite read-only, verifica arquivos/assinaturas/tamanhos, imprime apenas contagens e bytes por padrão. --apply exige quota de bytes aprovada, PostgreSQL/Storage, manutenção e destino vazio; não mescla identidades nem sobrescreve linhas. Transfere objetos com intenções duráveis, preserva IDs, hashes, sessões, revisões e JSON. A cópia original não é modificada. Destino com dados, mídia >50 MB ou referências incompatíveis precisam de revisão autorizada, não descarte automático.

## Testes executados e limites da evidência

- npm run typecheck: aprovado.
- npm test com TEST_DATABASE_URL: 23 testes aprovados, zero skipped no conjunto com PostgreSQL local disponível.
- npm run build: API e frontend aprovados.
- npm run test:e2e com E2E_DATABASE_URL: 6 aprovados (desktop e perfil Android Chromium emulado), usando PostgreSQL real local e Storage local de teste. Não é teste em aparelho Android físico.
- npm run build:vercel com origem de backend explicitamente fictícia de teste: build estático e manifesto gerados. Não houve requisição à origem fictícia ou deploy.
- Migrations locais: executadas e repetidas; nada executado remotamente.
- npm ci --no-audit --no-fund: instalação limpa de 132 pacotes, exit 0 na sequência final. Não se presume resultado remoto do Actions.
- npm audit --omit=dev --json: zero advisories nas dependências de produção nesta consulta; não é garantia de ausência de toda vulnerabilidade.
- Auditoria dos arquivos candidatos: nenhum padrão de segredo real ou artefato privado encontrado. Senhas/keys explicitamente fictícias em testes não são credenciais de produção.

Os testes PG cobrem criação/reset de owner, senha inválida, sessões/logout/restart, cadastro 403, isolamento, SQL injection como valor literal, revisão concorrente, rollback, falha real de metadata via trigger, compensação de objeto, limite de 50 MB, host privado RLS/REVOKE para anon/authenticated, quotas simuladas, bloqueio de geração, deduplicação concorrente, reserva após restart, perda de conexão simulada no health, reconciliação e importação legada. Os doubles não são apresentados como Supabase real.

## Implantação, bloqueios e checklist

Render.yaml prepara somente Free, sem disco e sem auto-deploy; o app não roda migration no build/start. Vercel.json usa Build Output API para proxy de mesma origem a API_ORIGIN, mantido fora do bundle, e fallback SPA depois da API. O domínio nexocenastudio.vercel.app não foi alterado. Secrets não devem existir no frontend nem em VITE_*. Cotas, suspensão, backups e elegibilidade dos planos gratuitos precisam ser conferidos nos painéis; não há SLA garantido. Nenhum plano pago foi contratado ou cobrança configurada.

- [x] Código usa PostgreSQL/Storage em produção e recusa fallback local.
- [x] Revisões, sessões, jobs e concorrência testados em PostgreSQL real isolado.
- [x] Upload/GET/DELETE privados, assinatura/50 MB e compensação testados localmente.
- [x] Owner privado, reset seguro e geração paga bloqueada testados.
- [x] Build de API, web e manifesto Vercel validado localmente.
- [ ] DATABASE_URL e SUPABASE_SECRET_KEY disponíveis em gerenciador seguro; ausentes neste ambiente.
- [ ] Rede para hostname real do pooler PostgreSQL e kdwtbefpbcyendvtuufb.supabase.co autorizada; política atual não garante esses destinos.
- [ ] Migrations, bucket privado, quota, TLS e owner real homologados no Supabase.
- [ ] Render Free criado/URL real confirmada, credenciais injetadas e health pronto após restart.
- [ ] Preview Vercel com API_ORIGIN real, cookies e mídia homologados sem mudar produção.
- [ ] Backup PostgreSQL+objetos e ensaio de restauração real aprovados.
- [ ] Autorização específica para publicação final.

Ações mínimas para desbloquear: disponibilizar DATABASE_URL (pooler correto) e SUPABASE_SECRET_KEY no ambiente seguro de execução, liberar rede e acesso de operação aos provedores ou realizar os passos manuais do guia. Não enviar valores em chat. Depois validar dados existentes antes de migration/import, owner e Preview. A publicação final depende de autorização posterior. **A tarefa de implantação não é declarada concluída enquanto esses itens permanecerem bloqueados.**

## Arquivos desta entrega (base d34b221)

| Estado | Arquivo |
| --- | --- |
| M | `.env.example` |
| M | `.github/workflows/ci.yml` |
| M | `.gitignore` |
| M | `README.md` |
| A | `apps/api/src/database.ts` |
| M | `apps/api/src/generation.ts` |
| A | `apps/api/src/media-store.ts` |
| M | `apps/api/src/security.ts` |
| M | `apps/api/src/server.ts` |
| M | `apps/api/src/supabase-storage.ts` |
| M | `apps/web/src/main.tsx` |
| M | `docs/DEPLOY_PRIVATE.md` |
| A | `docs/FREE_HOSTING_REPORT.md` |
| A | `docs/FREE_HOSTING_SUPABASE.md` |
| M | `docs/OPERATIONS.md` |
| M | `docs/PRODUCTION_READINESS.md` |
| M | `docs/STATUS.md` |
| M | `docs/VIDEO.md` |
| M | `package-lock.json` |
| M | `package.json` |
| M | `playwright.config.ts` |
| A | `render.yaml` |
| M | `scripts/backup.ts` |
| M | `scripts/create-user.ts` |
| A | `scripts/import-legacy.ts` |
| A | `scripts/init-test-postgres.mjs` |
| A | `scripts/migrate-postgres.ts` |
| A | `scripts/prepare-vercel.d.mts` |
| A | `scripts/prepare-vercel.mjs` |
| A | `scripts/reconcile-storage.ts` |
| A | `supabase/migrations/20261029_nexocena_private_storage_cleanup.sql` |
| A | `supabase/migrations/20261029_nexocena_private_tombstones.sql` |
| A | `tests/postgres.test.ts` |
| M | `tests/security.test.ts` |
| M | `tests/supabase-storage.test.ts` |
| A | `tests/vercel.test.ts` |
| A | `vercel.json` |

## Commits por etapa

- 11a4c9515e0b2f2a69e26fba6a463e66cd2f7407 — API PostgreSQL/Storage e ferramentas de migração/provisionamento.
- b4f7bd9f9c4466e9453ac5a81b640c2a5b472cb0 — reconciliação durável validada no PostgreSQL.
- Configuração Free/CI e documentação: commit final informado no chat e disponível no git log; nenhum merge.
