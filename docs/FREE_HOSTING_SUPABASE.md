# Guia de migração e implantação gratuita

Este guia é a referência atual da branch develop/free-hosting-supabase. Não execute publicação final sem autorização explícita. Documentos anteriores sobre Render pago/SQLite persistente são históricos.

## 1. Arquitetura e segurança

Navegador → Vercel (mesma origem /api) → Fastify Node 24 no Render Free → PostgreSQL e Storage Supabase. Schema `nexocena_private`, bucket privado `nexocena-media`, projeto informado `kdwtbefpbcyendvtuufb`. A API não depende de arquivos persistentes em produção. O serviço pode suspender/reiniciar sem perder projetos/sessões/mídias; disponibilidade contínua não é garantida por planos gratuitos.

O frontend não recebe DATABASE_URL, SUPABASE_SECRET_KEY ou credenciais Runway. O schema é acessado por pg no backend, não por PostgREST do navegador. Não adicione o schema privado à lista de schemas expostos na Data API. As migrations revogam privilégios de public/anon/authenticated e habilitam RLS. O backend precisa de um papel autorizado a operar esse schema; não conceda permissões a anon para fazer o aplicativo funcionar. A secret key Storage tem privilégios elevados: guarde somente no gerenciador de segredos do backend.

Autenticação permanece própria, com senhas scrypt e salt, sessão aleatória armazenada como hash, expiração de sete dias e cookies HttpOnly/Secure/SameSite=Lax. CSRF exige cabeçalho customizado e origem permitida; nenhum CORS externo é aberto. Prefira sempre o rewrite HTTPS Vercel. APP_PREVIEW_ORIGINS aceita apenas origens HTTPS exatas, separadas por vírgulas, para uma Preview autorizada; não aceita wildcard. Sessões de Preview e produção são cookies de hosts distintos.

## 2. Configuração e migrations Supabase

Obtenha a conexão PostgreSQL no painel do projeto. Para Render com conectividade IPv4, prefira o pooler Supavisor compatível; use a URL real fornecida pelo painel, não invente hostname, senha ou usuário. Pool padrão 2, sem prepared statements nomeados, sem search_path mutável e com schema explicitamente qualificado. TLS sempre verificado em produção; sslmode=require na URL não desliga a validação. Se necessário, injete a CA oficial em DATABASE_SSL_CA. DATABASE_SSL=false é permitido somente em teste/desenvolvimento.

Verifique no painel que o projeto e bucket estão no plano gratuito, bucket privado, limite de arquivo 50 MB, cotas livres de banco/storage/egress e nenhuma contratação/add-on pago. A auditoria não consultou nem alterou essas configurações reais. Startup valida o bucket privado e recusa configuração inválida; /api/health verifica banco e bucket, retorna 503 quando degradado.

Com credenciais em um arquivo protegido fora do Git (permissão 0600), em checkout confiável Node 24 na raiz:

```sh
npm ci
node --env-file=/caminho-seguro/backend.env --import tsx scripts/migrate-postgres.ts
```

Não use URLs com senha como argumentos de comando. O runner usa DATABASE_URL do ambiente; aplica arquivos SQL em transação com lock e registra schema_migrations. Pode ser repetido. Nenhuma migration roda automaticamente no startup ou no build Render.

Migrations previstas: inicial fornecida, storage_cleanup e tombstones. A inicial declara ter sido aplicada anteriormente, mas isso não foi confirmado na conta remota. Os IF NOT EXISTS permitem reexecução; as incrementais não removem dados. A API recusa servir sem as tabelas/coluna novas. Faça backup antes de qualquer execução remota.

## 3. Preservar legado e criar/resetar proprietário

Se houver SQLite/disco a migrar, **não apague a origem**. Pare a escrita na API antiga, copie banco/mídias para backup seguro, confira integridade e quota Supabase livre. O plano abaixo lê SQLite em modo read-only e não escreve no destino:

```sh
SQLITE_IMPORT_DIR=/copia-preservada npm run db:import-legacy
```

O plano lista apenas contagens e bytes. Arquivo ausente, assinatura inválida ou arquivo >50 MB bloqueiam importação; não truncar/recomprimir silenciosamente. Confirme espaço e configure IMPORT_MAX_STORAGE_BYTES com um teto que caiba na quota livre. Somente então, em ambiente seguro com DATABASE_URL/Storage:

```sh
node --env-file=/caminho-seguro/backend.env --import tsx scripts/import-legacy.ts --apply
```

O destino deve estar vazio; a operação recusa sobrescrever usuários/projetos existentes ou mesclar e-mails por adivinhação. Preserva IDs, hashes, sessões, revisões, histórico e objetos. Usa transação para dados e intenções duráveis para compensar uploads parciais. Pool de pelo menos 2 conexões; executar somente em manutenção com a API parada. Se falhar após transferir objetos, não remova o backup e não reenvie cegamente: confira storage_cleanup e reconcilie. Não apague objetos existentes com colisão de ID para forçar passagem. Legado com referências órfãs pode ser rejeitado pelas FKs: exige revisão autorizada, sem descarte automático.

Se o Supabase já tiver dados, faça comparação offline e proposta de mapeamento antes da importação. Não crie um owner novo antes de importar um legado com o mesmo e-mail. Caso não haja legado, provisione o proprietário diretamente. PRIVATE_OWNER_EMAIL=mkprod.60@gmail.com. O script não contém senha fixa; lê somente stdin:

```sh
set +x
read -r -s -p 'Senha forte do proprietário: ' owner_password
printf '\n'
printf '%s' "$owner_password" | node --env-file=/caminho-seguro/backend.env --import tsx scripts/create-user.ts
unset owner_password
```

Para redefinição autorizada, use o mesmo procedimento acrescentando `--reset` ao script. O ID e projetos permanecem; todas as sessões desse usuário são revogadas. Sem --reset, uma conta existente é recusada. Não exponha um endpoint administrativo de provisionamento e não imprima senha em logs/chat.

## 4. Render Free

Preparado em render.yaml, **não aplicado**. Confirme que a interface indica plano Free e nenhum disco pago. Nome desejado nexocenastudio-api; a URL real só existe após provisionamento e pode diferir do nome desejado. Não presuma que uma URL planejada já está funcionando.

- Branch: develop/free-hosting-supabase.
- Runtime: Node 24.
- Build: npm ci && npm run build:api.
- Start: npm run start:api.
- Health: /api/health.
- Sem disco persistente e sem migration durante build/boot.
- Auto-deploy desativado no blueprint; qualquer publicação deve ser explícita.

Injete NODE_ENV=production, ACCESS_MODE=private, PRIVATE_OWNER_EMAIL=mkprod.60@gmail.com, REGISTRATION_ENABLED=false, APP_ORIGIN=https://nexocenastudio.vercel.app, DB_POOL_MAX=2, SUPABASE_URL=https://kdwtbefpbcyendvtuufb.supabase.co, SUPABASE_STORAGE_BUCKET=nexocena-media e os dois segredos DATABASE_URL/SUPABASE_SECRET_KEY. RUNWAY_GENERATION_ENABLED=false e RUNWAY_DAILY_CREDIT_LIMIT=0 são obrigatórios; configurações que tentam habilitar geração são recusadas no startup. Não configure chave Runway.

Render Free pode suspender por inatividade e tem limites de horas, CPU, RAM, banda e build. Supabase Free também pode pausar/limitar recursos. Confirme valores atuais nos painéis antes de publicar. Não use pings para contornar a suspensão, não habilite cobrança automática nem contrate serviços pagos. Um upload simultâneo por instância e 50 MB por arquivo limitam memória; o limite real de bucket pode ser menor. Transações/objetos não dependem do disco temporário. SIGTERM/SIGINT encerram a API e pool de forma graciosa; em interrupções abruptas, as intenções persistidas permitem reconciliação.

## 5. Vercel existente, Preview primeiro

Preserve o projeto/domínio nexocenastudio.vercel.app; não crie outro domínio de produção e não faça merge na main. O root vercel.json configura um build customizado (Framework Other/null) que ainda compila React/Vite, mas gera **Vercel Build Output API**. Isso permite configurar a origem real do backend por variável de build sem inserir placeholders no código nem segredos no bundle.

- Root Directory: raiz do repositório ./.
- Install: npm ci.
- Build: npm run build:vercel.
- Framework: Other; vercel.json fixa framework null.
- Output Directory: remover override antigo apps/web/dist; o build produz .vercel/output/config.json e .vercel/output/static.
- Node 24.
- Única variável do build: API_ORIGIN, origem HTTPS **real** da API Render, sem path/token/senha. Não usar VITE_API_KEY, DATABASE_URL ou secret key no frontend.

O primeiro route /api é externo e precede o fallback SPA; depois arquivos estáticos e index.html. O proxy dev API_TARGET não é usado. O build falha sem API_ORIGIN válida e recusa apontar a API ao próprio frontend (loop). Exemplo oficial consultado de Build Output API: https://github.com/vercel/examples/tree/main/build-output-api. A compatibilidade final com as configurações do seu projeto Vercel ainda precisa de uma Preview real; não foi implantada.

Use a branch develop/free-hosting-supabase como Preview, sem promover para produção. Confirme no painel Environment=Preview e commit correto antes de qualquer ação. Não pressione Deploy na importação inicial supondo que ela será Preview. Se precisar testar uma origem Preview diferente do APP_ORIGIN, autorize exatamente o domínio em APP_PREVIEW_ORIGINS do backend de homologação. Não use wildcard *.vercel.app e não altere a origem de produção para acomodar qualquer site.

Homologue HTTPS, cookies, login/logout, projeto, AutoSave, mídia pequena, Range/seek, reinício da API, limite de tamanho e erros de quota. Teste arquivos maiores conscientemente dentro das cotas; redirects externos podem ter limites próprios de timeout/payload. Use rewrite externo, não uma função proxy com limite de body incompatível. Não armazene cache de /api no CDN. A configuração não executa deploy nem altera as configurações do projeto sozinha.

## 6. Falhas parciais, reconciliação e backups

Upload valida MIME/assinatura e tamanho. Metadados não apontam para objeto antes da confirmação de upload. Antes da operação é registrada uma intenção em storage_cleanup; metadados e remoção da intenção são atômicos. Em commit com resultado incerto, o handler relê metadados antes de excluir qualquer objeto; não apaga mídia possivelmente confirmada. Exclusão protege referências atuais/histórico, remove acesso do banco e mantém intenção se o Storage falhar. Projeto é removido logicamente para não quebrar FKs de tarefas/custos. Nenhum dado legado é apagado pela migração.

`npm run storage:reconcile` processa somente intenções com mais de 24h, sob lock, verifica ausência de metadados e só então exclui o objeto. Executar por manutenção autorizada; não foi agendado nem rodado contra seu bucket real. Intenções e objetos não referenciados não devem ser apagados manualmente por listas incompletas. O limite 24h evita disputar operações ainda em andamento, mas eventos excepcionais precisam de revisão.

Free não equivale a backup gerenciado/PITR. Reserve backup externo criptografado dentro de uma solução gratuita aprovada, sem presumir cota ilimitada. Pare as escritas, exporte schema/dados PostgreSQL com pg_dump em conexão segura e objetos privados com manifesto/hash; verifique os dois conjuntos. Use credenciais por pg_service/.pgpass 0600 ou secret injection, não URL com senha em argv. O antigo comando backup SQLite é bloqueado com DATABASE_URL/production e não substitui esse processo. Nenhum backup remoto foi configurado por esta entrega.

Restauração deve ocorrer primeiro em ambiente isolado: confira contagens, IDs, revisão e hashes de objetos; teste owner, sessões, mídias e jobs. Não restaure dados de teste em produção. Rollback conserva origem SQLite e snapshot PostgreSQL/Storage anteriores; reverter código não reverte schema nem objetos automaticamente. Tarefas Runway e cobranças remotas não são desfeitas por restauração, mas aqui permanecem bloqueadas. Não implante código antigo SQLite num serviço Free para fazer rollback: use snapshot/código PostgreSQL compatíveis ou volte a um ambiente legado separado preservado.

## 7. Testes e cotas

O CI tem PostgreSQL 17 descartável, papéis anon/authenticated de fixture, migrations, TypeScript, testes, Chromium e build. TEST_DATABASE_URL deve ser exclusivamente um banco *_test; E2E_DATABASE_URL permite repetir os testes de navegador contra ele. Sem TEST_DATABASE_URL, os casos reais PG são skipped e isso não constitui aprovação do driver.

O código foi testado com PostgreSQL local real e doubles de Storage. Supabase HTTP real, TLS do pooler real, cotas e provedores de hospedagem continuam sem homologação por falta de acesso. Fontes para confirmar limites: https://supabase.com/pricing, https://supabase.com/docs/guides/platform/going-into-prod, https://render.com/docs/free, https://vercel.com/docs/plans/hobby. Não se afirma que o plano gratuito Vercel seja permitido para qualquer uso comercial: confirme elegibilidade/termos. Não há contratação paga autorizada. Registre a quota disponível, não estime preço de API como crédito Flow.
