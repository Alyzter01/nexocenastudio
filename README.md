# NEXOCENA STUDIO

Da narrativa à imagem. Da imagem ao filme.

Site responsivo para celular e computador: React/Vite, API Fastify, SQLite no servidor e mídias privadas no disco. Não há aplicativo Android, Capacitor ou APK. Veja o [estado da implementação](docs/STATUS.md).

## Desenvolvimento

Node.js 24 e npm 11, no checkout existente (não é necessário criar worktree):

```sh
npm ci
ACCESS_MODE=multiuser REGISTRATION_ENABLED=true npm run dev
```

Frontend na porta 5173, API na 3001. O Vite encaminha `/api` para o backend. No modo multiusuário de desenvolvimento acima, crie sua conta com senha de pelo menos 12 caracteres. O padrão é privado e exige PRIVATE_OWNER_EMAIL; para uso privado siga [DEPLOY_PRIVATE.md](docs/DEPLOY_PRIVATE.md). Não há dados demonstrativos pré-carregados. A API cria `apps/api/.data` quando iniciada pelo workspace; use `DATA_DIR` absoluto em produção.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Com Chromium do sistema:
# PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

O CI valida somente a aplicação web e disponibiliza o build estático como artifact. Não publica automaticamente.

## Produção audiovisual

Cadastro/login → projeto vazio → roteiro → cenas manuais → importação de mídias ou geração pela API oficial Runway → associação → reprodução → aprovação. AutoSave com revisão otimista e recuperação de rascunho local. Exportação de projeto JSON e lista de prompts. Renderização/montagem MP4 completa ainda pendente.

## Vídeo por IA

Adaptador oficial Runway Gen-4.5: texto para vídeo, horizontal/vertical, 2–10 segundos. Gere uma estimativa no projeto e confirme explicitamente a cobrança. Sem chave ou tarifa configurada, o botão permanece indisponível. A configuração não significa acesso validado ou garantia de disponibilidade. Consulte [configuração e operação do vídeo](docs/VIDEO.md).

## Deploy

Leia o [guia privado](docs/DEPLOY_PRIVATE.md) e o [relatório de prontidão](docs/PRODUCTION_READINESS.md). `npm run build` agora compila API e frontend; `npm run start:api` executa JavaScript compilado.

O frontend pode ser servido na Vercel; a API atual exige processo Node persistente e volume durável para SQLite/mídias. **Publicar apenas o frontend não entrega o sistema completo.** Encaminhe `/api` para o backend pelo mesmo domínio HTTPS. Veja [operação e recuperação](docs/OPERATIONS.md).

O símbolo vetorial foi criado para o projeto. Sem fontes comerciais. Licenças de dependências são distribuídas nos respectivos pacotes.
