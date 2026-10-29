# Estado da implementação

> Na branch develop/free-hosting-supabase, a arquitetura atual usa PostgreSQL/Supabase Storage e Render Free. Este documento contém contexto histórico; a referência de implantação atual é [FREE_HOSTING_SUPABASE.md](FREE_HOSTING_SUPABASE.md) e a evidência atual está em [FREE_HOSTING_REPORT.md](FREE_HOSTING_REPORT.md).

## Escopo atual: somente site

- Web responsiva para celular e computador, com navegação mobile e desktop.
- Android/Capacitor/APK, dependências e build nativo removidos a pedido do usuário.
- CI dedicado a tipos, testes de API, Playwright, build web e artifact estático.
- Cadastro/login/logout, projetos, roteiro, cenas, AutoSave com revisão, recuperação e mídias privadas preservados.
- Exportação JSON e prompts, biblioteca e aprovação manual.

## Vídeo

- Adaptador oficial Runway Gen-4.5 (2–10 segundos, horizontal/vertical, prompt até 1.000 caracteres).
- Estimativa persistida com validade, modal de confirmação e validação de mudanças na cena/tarifa.
- Tarefas persistentes, deduplicação, limites por usuário/cena, polling limitado, estados de falha e envio incerto.
- Importação do resultado MP4 para biblioteca privada, com host permitido, timeout e limite de tamanho.
- Sem chave ou tarifa no backend, geração desabilitada. Nenhuma integração Flow privada.

## Validação

Os testes de vídeo são explicitamente simulados e não fazem chamadas pagas. Há testes do contrato do adaptador, confirmação, isolamento, duplicidade, polling, reinício e envio incerto; Playwright verifica o fluxo existente e a confirmação de custo em desktop/mobile. Os resultados reais de execução são relatados no chat. Não há credenciais Runway configuradas neste ambiente; geração real e transferência real do provedor ainda não foram homologadas.

## Pendências

- Configurar chave, saldo, acesso ao modelo, tarifa e hosts de saída Runway no backend. Homologar geração real mediante autorização de custo.
- Hospedar frontend e API persistente com HTTPS. O backend SQLite/disco atual não é adequado às funções efêmeras da Vercel.
- PostgreSQL/S3 e coordenação distribuída para escalar além de uma instância.
- Reconciliação administrativa de tarefas incertas, custos efetivamente cobrados e cancelamento.
- Análise narrativa por IA, continuidade visual, worker FFmpeg e exportação de montagem MP4.
- Recuperação de conta, preferências sincronizadas, IndexedDB, inspeção completa de uploads, backups automatizados e requisitos restantes de produção.

Esta é uma implementação de desenvolvimento em evolução. Site publicado, qualidade/estabilidade da geração real e conclusão do produto não são alegados sem validação correspondente.

## Auditoria de preparação privada

Veja [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md): modo privado, uploads e egress reforçados, teto financeiro transacional, backup/restauração, API compilada e CLI de provisionamento. Classificação: APROVADO PARA HOMOLOGAÇÃO, sem deploy ou geração paga. Os resultados anteriores nesta página não substituem o relatório da auditoria atual.
