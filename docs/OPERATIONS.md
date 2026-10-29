# Operação e limites

## Desenvolvimento

Cada tarefa já é isolada: use o checkout existente, sem criar worktree. Node 24, npm ci, npm run dev. Persistência real em SQLite com WAL e mídia no disco privado. Não há dependência de IA ou conta externa para o fluxo manual.

## Implantação inicial (homologação)

Compile com `npm run build`. Sirva `apps/web/dist` via HTTPS, fallback de rotas para index.html e proxy `/api` para o processo `npm run start -w apps/api`. Use `NODE_ENV=production`, volume persistente absoluto em DATA_DIR e limite de upload de 100 MB no proxy. Não exponha a API diretamente à internet. Sem CORS externo: web/API devem compartilhar origem. Cookies HttpOnly, SameSite=Lax e Secure em produção. Cabeçalho customizado obrigatório para mutações, sem autorização CORS. Senhas scrypt com salt aleatório; sessões aleatórias armazenadas como hash e expiração de sete dias. Rate limit em autenticação e API.

SQLite e disco local são adequados somente à primeira instância de homologação; não escale réplicas com discos independentes. PostgreSQL/migrations versionadas, S3 com URLs assinadas, OIDC/recuperação de conta, verificação de conteúdo dos uploads e limites de retenção são requisitos pendentes para produção. MIME e assinatura básica do contêiner são verificados; isso não equivale a antivírus, decodificação completa ou transcodificação. O JSON do projeto não inclui arquivos de mídia. Nenhum backup automático é anunciado.

## Backup e recuperação

O comando `npm run backup` (ou `node dist/server/scripts/backup.js`) usa backup SQLite e copia apenas mídias referenciadas no snapshot, com SHA-256 e marcador INCOMPLETE. Exige DATA_DIR e BACKUP_DIR novo, não sobreposto. Testado apenas em dados temporários; verifique [DEPLOY_PRIVATE.md](DEPLOY_PRIVATE.md) antes de operar dados reais.

Pare a API antes de copiar todo DATA_DIR, incluindo banco, arquivos WAL/SHM existentes e subdiretório media. Use armazenamento criptografado e acesso restrito. Restaure em um volume separado, configure DATA_DIR, inicie a API e verifique login, projetos e reprodução. Defina retenção e faça restaurações periódicas de teste antes de produção. Não copie banco ativo com um simples cp.

## IA e processamento

A API inclui adaptador Runway Gen-4.5 com tarefas persistidas, confirmação de custo e importação privada de MP4. A configuração e os limites estão em [VIDEO.md](VIDEO.md). Sem chave/tarifa, o provedor permanece indisponível. Não houve geração paga real homologada. O site funciona com mídias importadas manualmente. FFmpeg/worker de montagem ainda não foi implementado.

O produto é exclusivamente web, responsivo para celular e computador. Não há projeto Android nem build APK. O frontend pode ficar na Vercel; SQLite e disco local exigem uma API externa persistente com volume durável e encaminhamento `/api` pela mesma origem HTTPS.

## Offline

Service worker somente via HTTPS, com página offline e ícone. Não armazena respostas privadas ou vídeos. Rascunhos ficam em localStorage, não IndexedDB, e não substituem o backend. Fechar a página com edição pendente dispara aviso. Erros e conflitos exigem revisão explícita. Dados locais não são criptografados e podem permanecer no dispositivo: não use dispositivos compartilhados nesta versão. Recuperação offline completa ainda pendente.

## Acesso privado

Padrão ACCESS_MODE=private, PRIVATE_OWNER_EMAIL obrigatório. Cadastro bloqueado, sessões de outras contas negadas sem apagar seus dados. Crie a primeira conta offline pelo script create-user; não há credencial administrativa fixa. Produção exige APP_ORIGIN HTTPS, cookies Secure/HttpOnly/SameSite Lax e origem de requisição compatível. No modo multiusuário, cadastro só é aberto com REGISTRATION_ENABLED=true explícito.
