# NEXOCENA — estado verificável da migração Cloudflare (2026-10-29)

## Bloqueio externo
O executor do Codex reportou `No usable execution environment is available`. Não há evidência de checkout ou execução de testes pelo Codex. Este documento foi criado diretamente via GitHub na branch experimental.

## Inspeção estática confirmada via GitHub
- `apps/worker/src/index.ts`: apenas `GET /api/health`; demais endpoints retornam 503 (fail closed).
- `apps/worker/migrations/0001_initial.sql`: tabelas iniciais `projects` e `flow_credit_ledgers`; sem tabelas de autenticação ou sessões.
- `apps/api/src/server.ts`: backend atual usa Fastify, cookies, rate limit, multipart, `node:crypto` e banco SQL. Não pode ser presumido compatível com runtime Workers sem portagem.
- `apps/api/src/database.ts`: backend atual suporta PostgreSQL/SQLite e exige `DATABASE_URL` em produção; não há integração operacional com D1.

## Decisões de segurança
1. Não apontar o frontend de produção para o Worker experimental.
2. Não habilitar rotas de projeto ou créditos sem autenticação e autorização comprovadas.
3. Não importar hashes de senha ou sessões sem estratégia de compatibilidade segura.
4. Não persistir arquivos de vídeo no D1.
5. Não fazer deploy, criar recursos Cloudflare ou executar migrations remotas nesta fase.
6. Não afirmar que houve build, typecheck, testes ou homologação: ainda não foram executados.

## Próximas entregas sugeridas
1. Mapear contrato de endpoints do frontend e API atual.
2. Implementar autenticação Workers e testes locais de isolamento entre usuários.
3. Implementar CRUD de projetos e ledger com CAS/revision, validação e testes.
4. Criar integração de frontend somente em configuração experimental.
5. Executar `npm ci`, `npm run typecheck`, `npm test`, `npm run build` e testes locais Wrangler quando houver executor funcional.

## Situação
Implementação experimental ainda incompleta. O documento não equivale a validação de funcionamento.
