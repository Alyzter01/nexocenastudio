# Relatório técnico — 2026-10-28

## Implementado

- Monorepo npm com API, web, Android e schemas compartilhados Zod.
- Interface escura responsiva, navegação inferior mobile, símbolo vetorial próprio.
- Cadastro, login/logout, sessões HttpOnly, rate limit, autorização por proprietário.
- Projetos vazios, editor de roteiro, cenas manuais, duração, formato, aprovação.
- AutoSave no backend, controle de revisão e rascunho local recuperável.
- Upload persistente no disco privado, biblioteca, reprodução e download autenticado.
- Exportação JSON e prompts; visão sequencial de montagem sem renderização.
- Manifesto, tela offline e service worker restrito a recursos públicos mínimos.
- Projeto Capacitor nativo e CI para APK debug com checksum.

## Validação

Consulte os resultados reais apresentados no chat. Teste de API usa banco real temporário e verifica cadastro/login, sessão, validação, autorização, isolamento, conflito e persistência após reinício. Não usa provedor pago. Não substitui teste de navegador ou dispositivo.

## Pendente por etapa

1. Fundação: PostgreSQL/ORM e migrations, autenticação gerenciada com recuperação, lint/formatação e design system extraído.
2. Produto: IndexedDB, preferências sincronizadas, histórico visível, favoritos/arquivo, upload com inspeção de conteúdo, S3, operações avançadas de cenas, testes de UI.
3. Android: execução do workflow remoto, APK verificado, homologação dos ícones/splash próprios, plugins de arquivo/compartilhamento/ciclo de vida, homologação em dispositivo.
4. Inteligência narrativa: adaptador oficial e respostas estruturadas. Indisponível na UI.
5. Geração: contratos/adaptadores, fila, estimativa, confirmação e auditoria. Indisponível; sem credenciais.
6. Pós-produção: worker FFmpeg, timeline com trims/faixas, compilação parcial/completa, SRT/VTT e backup com manifesto.
7. Produção: OIDC/recuperação, retenção, observabilidade, monitoramento, E2E, deploy real, landing/páginas legais e download com metadados reais, assinatura release.

Esta versão é uma base funcional de desenvolvimento, não o produto completo nem uma versão homologada para produção. Não há APK, publicação, sincronização Android ou exportação MP4 verificados.

## Resultados confirmados nesta instância

- TypeScript: aprovado.
- Build Vite: aprovado.
- Teste de integração API: 1 cenário aprovado (cadastro, isolamento, revisão, restauração, login/logout).
- Playwright/Chromium real: 1 cenário aprovado em desktop e viewport mobile (cadastro, projeto vazio, autosave, reload, restauração e fechamento intencional).
- Requisição HTTP por Vite para /api/health: banco respondendo, provedores indisponíveis.
- Capacitor add/sync: concluído. Build APK e instalação: não executados, SDK ausente.
