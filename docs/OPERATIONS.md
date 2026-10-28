# Operação e limites

## Desenvolvimento

Cada tarefa já é isolada: use o checkout existente, sem criar worktree. Node 24, npm ci, npm run dev. Persistência real em SQLite com WAL e mídia no disco privado. Não há dependência de IA ou conta externa para o fluxo manual.

## Implantação inicial (homologação)

Compile com `npm run build`. Sirva `apps/web/dist` via HTTPS, fallback de rotas para index.html e proxy `/api` para o processo `npm run start -w apps/api`. Use `NODE_ENV=production`, volume persistente absoluto em DATA_DIR e limite de upload de 100 MB no proxy. Não exponha a API diretamente à internet. Sem CORS externo: web/API devem compartilhar origem. Cookies HttpOnly, SameSite=Lax e Secure em produção. Cabeçalho customizado obrigatório para mutações, sem autorização CORS. Senhas scrypt com salt aleatório; sessões aleatórias armazenadas como hash e expiração de sete dias. Rate limit em autenticação e API.

SQLite e disco local são adequados somente à primeira instância de homologação; não escale réplicas com discos independentes. PostgreSQL/migrations versionadas, S3 com URLs assinadas, OIDC/recuperação de conta, verificação de conteúdo dos uploads e limites de retenção são requisitos pendentes para produção. O MIME declarado é limitado, mas ainda não há inspeção de assinatura, antivírus ou transcodificação. O JSON do projeto não inclui arquivos de mídia. Nenhum backup automático é anunciado.

## Backup e recuperação

Pare a API antes de copiar todo DATA_DIR, incluindo banco, arquivos WAL/SHM existentes e subdiretório media. Use armazenamento criptografado e acesso restrito. Restaure em um volume separado, configure DATA_DIR, inicie a API e verifique login, projetos e reprodução. Defina retenção e faça restaurações periódicas de teste antes de produção. Não copie banco ativo com um simples cp.

## IA e processamento

Não há adaptador externo implementado ou configurado. Omni/Flow indisponível; nenhuma substituição automática. A análise narrativa, custos e geração não são executados. Não foram solicitadas chaves ou cobranças. FFmpeg está disponível na máquina, mas fila/worker, isolamento de recursos e compilação MP4 ainda não estão implementados. Mídias importadas podem ser associadas e aprovadas; a montagem mostra a sequência, sem renderizar.

## Offline

Service worker somente via HTTPS, com página offline e ícone. Não armazena respostas privadas ou vídeos. Rascunhos ficam em localStorage, não IndexedDB, e não substituem o backend. Fechar a página com edição pendente dispara aviso. Erros e conflitos exigem revisão explícita. Dados locais não são criptografados e podem permanecer no dispositivo: não use dispositivos compartilhados nesta versão. Recuperação offline completa ainda pendente.
