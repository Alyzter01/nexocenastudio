# NEXOCENA — preparação para uso real (Cloudflare experimental)

**Estado:** implantação remota NÃO executada. Esta documentação não autoriza migração de produção. A prévia Vercel permanece DEMO e seus dados são somente locais.

## Bloqueadores antes de publicar

1. Confirmar, no painel Cloudflare, que a conta tem permissão de Workers e D1. A conexão ChatGPT identificou a conta, mas a execução de API Cloudflare foi bloqueada pela ferramenta.
2. Criar **novo D1 experimental** (não reutilizar banco existente), registrar o ID em `apps/worker/wrangler.jsonc` **somente na branch experimental** e aplicar as migrações `0001` a `0004`.
3. Registrar variáveis do Worker com acesso restrito:
   - `EXPERIMENT_REMOTE_ENABLED=true` apenas após testes e aprovação explícita.
   - `EXPERIMENT_OWNER_EMAIL` com o e-mail do proprietário (nunca senha).
   - `EXPERIMENT_SETUP_TOKEN_HASH` SHA-256 de um token aleatório de 32 bytes (64 caracteres hexadecimais). O token em texto claro **não** deve ser versionado ou exibido em logs.
   - `EXPERIMENT_REGISTRATION=true` **temporariamente** apenas durante a criação da conta proprietária; desligar imediatamente após cadastro.
4. Testar criação de conta com o token de convite, login, logout, separação entre contas, limites de tentativa e desempenho real do PBKDF2 no plano Workers Free. O cadastro requer o token de convite no cabeçalho `x-nexocena-setup`, além do e-mail permitido. Não publicar um link de cadastro sem esse controle.
5. Validar a política de cookies e origem: o frontend usa `/api` na mesma origem. Para a Vercel, será preciso proxy HTTPS para o Worker com cookies preservados. Não apontar para um backend de produção existente.
6. Somente então preparar uma **nova** prévia de teste conectada à API real; manter a demonstração separada. Executar smoke test com projeto descartável, revisão/histórico, reload, logout/login, Android e backup.
7. Habilitar armazenamento durável de mídias (ou IndexedDB + exportação com aviso explícito) antes de afirmar que vídeos e imagens persistem entre dispositivos.
8. Antes de migrar o domínio principal, fazer backup, plano de rollback, monitoramento de erros e testes com usuários reais.

## Comandos locais (ambiente de desenvolvimento, não produção)

Na raiz do repositório:

```sh
npm ci
npm run typecheck
npm run typecheck:worker
npm run test:worker
npm run test:workerd
npm test
npm run test:e2e
npm run build
```

Para operar D1 remoto, consultar a documentação oficial do Wrangler e autenticar manualmente na conta correta. Executar as migrações **apenas** após verificar o nome e ID do banco experimental e fazer backup. Não colar tokens de API no chat nem nos commits.

## Definição de pronto para uso diário

- Conta real com autenticação verificada e sem cadastro público.
- Projeto salvo no D1 e recuperado após fechar e reabrir o navegador em outro dispositivo.
- Histórico de revisões consistente e isolado por conta.
- Mídias com persistência/backup definido e testado.
- Sem uso automático de IA paga.
- Ambiente principal inalterado até aceite explícito de implantação.
