# NEXOCENA STUDIO

Da narrativa à imagem. Da imagem ao filme.

Versão inicial em desenvolvimento. Web React/Vite, API Fastify, SQLite no servidor e projeto Capacitor Android nativo. Não é uma entrega completa dos requisitos de produção; veja [relatório técnico](docs/STATUS.md).

## Executar

Node.js 24 e npm 11. Na raiz do checkout:

```sh
npm ci
npm run dev
```

Web: porta 5173. API: 3001. O Vite encaminha `/api` para a API. Cadastre uma conta com senha de pelo menos 12 caracteres. Não há conta ou projeto pré-carregado.

```sh
npm run typecheck
npm test
npm run build
# Com Chromium instalado pelo Playwright:
npx playwright install chromium
npm run test:e2e
# Ou: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

A API cria `apps/api/.data` quando iniciada pelo workspace; `DATA_DIR` pode apontar para um volume persistente. Os testes usam diretórios temporários isolados.

## Fluxo disponível

Cadastro/login → novo projeto vazio → roteiro → cenas manuais → upload de vídeos → associação e reprodução → aprovação → exportação JSON ou lista de prompts. AutoSave com revisão otimista no servidor e rascunho local de recuperação; o indicador diferencia rascunho de sincronização. Ao fechar intencionalmente um projeto, o último projeto ativo é limpo. Bibliotecas privadas por conta.

## Android

O código nativo fica em `apps/android/android`. Consulte [Android](docs/ANDROID.md). Não há APK verificado nesta entrega. A interface se adapta ao toque e à largura da tela. A configuração de visualização é local ao dispositivo.

## Segurança e implantação

Consulte [operação](docs/OPERATIONS.md). Sem chaves de IA no cliente, sem chamadas pagas, sem integração privada do Google Flow. Licenças das dependências são distribuídas pelos respectivos pacotes. O símbolo vetorial N foi criado para este projeto.
