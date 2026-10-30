# NEXOCENA — biblioteca, histórico e provedores (experimento)

## Escopo

Implementação isolada em `experiment/cloudflare-pages-workers-d1`. A branch `main` e o backend de produção não foram alterados diretamente.

## Tela inicial

- Após acessar, mostra a área **Comece com uma tela em branco** com chamada principal para novo projeto.
- A biblioteca **Meus projetos** mantém projetos existentes e permite filtrar por **Todos**, **Rascunhos**, **Em andamento** e **Finalizados**.
- Projetos novos iniciam em **Rascunho**. Projetos antigos sem status são mostrados como rascunho até alteração manual.
- Não exclui nem arquiva automaticamente nenhum projeto.
- O editor permite mudar o status; a biblioteca também oferece um seletor.
- O histórico registra revisões da própria API, por conta. Revisões anteriores à mudança podem não conter todos os dados.

## Persistência e isolamento

- O esquema compartilhado adiciona `status` e `videoProvider` com valores padrão para manter compatibilidade.
- O backend Node usa a tabela `versions` já existente; novos projetos gravam sua primeira revisão.
- O Worker usa a migration experimental `0004_project_versions.sql` e um endpoint de histórico protegido por sessão.
- O modo de demonstração mantém tudo no navegador, sem enviar dados a qualquer backend.
- Histórico de revisão não equivale a restauração de versões nem substitui backup manual.

## Escolha de gerador

No editor é possível escolher:

1. **Runway Gen-4.5**: integração API existente, apenas quando habilitada no backend não experimental, e sempre com confirmação explícita de custo.
2. **Google Flow / Gemini Omni Flash**: planejamento manual. Exporte prompts e abra a ferramenta oficial. Estimativas configuradas pelo usuário (4 s = 7, 6 s = 10, 8 s = 12, 10 s = 15 créditos), sujeitas a alterações do Google Flow. **Não existe geração direta**, não há consulta ao saldo real e nenhuma credencial é armazenada.

Não habilitar Gemini API, outras plataformas pagas ou geração remota sem consentimento e orçamento.

## Homologação

- `npm run typecheck`
- `npm run typecheck:worker`
- `npm run test:worker`
- `npm run test:workerd` (D1 local)
- `npm test`
- `npm run test:e2e` (desktop e Android)
- `npm run build`

Em prévia Vercel, conferir status READY e login Vercel. A prévia é demonstrativa com projetos locais; não é Cloudflare em produção e não gera mídia paga.
