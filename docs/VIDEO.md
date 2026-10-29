# Geração de vídeo — Runway

> Na branch develop/free-hosting-supabase, a arquitetura atual usa PostgreSQL/Supabase Storage e Render Free. Este documento contém contexto histórico; a referência de implantação atual é [FREE_HOSTING_SUPABASE.md](FREE_HOSTING_SUPABASE.md) e a evidência atual está em [FREE_HOSTING_REPORT.md](FREE_HOSTING_REPORT.md).

## Escolha e contrato

Integração oficial com Runway Gen-4.5, sem Google Flow, cookies de navegador ou endpoints privados. Contrato conferido no SDK oficial TypeScript:

- https://github.com/runwayml/sdk-node/blob/main/src/resources/text-to-video.ts
- https://github.com/runwayml/sdk-node/blob/main/src/resources/tasks.ts
- https://github.com/runwayml/sdk-node/blob/main/src/client.ts
- https://docs.dev.runwayml.com/

O adaptador usa HTTPS com Bearer no backend e `X-Runway-Version: 2024-11-06`, POST `/v1/text_to_video`, GET `/v1/tasks/:id`. Modelo fixo `gen4.5`, prompt de 1–1000 caracteres, duração inteira 2–10s, 16:9 (1280×720) ou 9:16 (720×1280). Não há substituição silenciosa por outro modelo. 1:1 e 4:5 continuam disponíveis para projetos manuais, mas não são enviados a este modelo.

## Configuração segura

No processo do backend:

- `RUNWAY_GENERATION_ENABLED`: deve ser explicitamente `true` para habilitar o adaptador. O padrão é bloqueado. Não habilitar durante auditorias.
- `RUNWAY_DAILY_CREDIT_LIMIT`: teto global positivo de créditos estimados em janela móvel de 24 horas. Zero/ausente bloqueia POST de geração. Todas as reservas contam, inclusive falhas e envios incertos; não há liberação automática por suposto reembolso. É proteção local, não comprovação da fatura ou garantia contra mudança de preço do provedor.
- `RUNWAYML_API_SECRET`: chave de API de uma conta Runway autorizada com saldo e acesso ao modelo.
- `RUNWAY_CREDITS_PER_SECOND`: tarifa positiva atual desse modelo, conferida pelo administrador no painel/documentação do provedor. Não há preço presumido embutido no código.
- `RUNWAY_OUTPUT_HOSTS`: hostnames HTTPS exatos dos resultados entregues pela Runway, separados por vírgula. Não use wildcard, IP privado ou destinos arbitrários. Libere os mesmos hosts no controle de saída da hospedagem. Importações recusam redirecionamentos e só aceitam esses hosts. Também rejeitam IPs literais, protocolos não HTTPS, credenciais na URL e DNS para endereços privados/reservados. A resolução prévia não fixa o endereço do transporte; a hospedagem/proxy deve bloquear egress para redes privadas para conter DNS rebinding.
- A rede deve permitir `api.dev.runwayml.com` e os hosts oficiais de saída. Em máquinas com proxy, Node 24 precisa iniciar com `NODE_USE_ENV_PROXY=1` para usar o proxy herdado. Preserve a verificação TLS.

Não coloque valores de chaves em frontend, `VITE_*`, Git, logs ou chat. O `.env.example` documenta nomes sem valores secretos. Não use créditos da assinatura Flow como saldo de API Runway.

A aplicação não carrega `.env` automaticamente. Exporte variáveis pelo gerenciador do serviço ou use o suporte `--env-file` do Node com arquivo local protegido, fora do Git. Reinicie a API após configurar.

## Fluxo e recuperação

1. Salve prompt, duração e formato da cena.
2. Solicite estimativa. O servidor congela o payload por 10 minutos e calcula créditos a partir da tarifa configurada; não realiza geração.
3. Revise prompt, duração e créditos no modal; autorize explicitamente a geração paga.
4. O servidor reserva a tarefa antes do envio, reserva o orçamento em transação SQLite e limita duas tarefas ativas por usuário e uma por cena e deduplica pela estimativa.
5. O estado é persistido em SQLite. Consultas ocorrem no máximo uma vez a cada cinco segundos por tarefa, enquanto o painel está aberto. O provedor continua a executar mesmo com o site fechado. Reabrir o projeto retoma a consulta, sem reenviar a geração.
6. Ao concluir, escolha salvar o MP4 na biblioteca. A transferência é autenticada, limitada a 100 MB e 60 segundos, valida o marcador de contêiner MP4 e mantém o original no disco privado. Depois a mídia é associada à cena, sem aprovação automática. O link temporário remoto não é apresentado como mídia preservada.

Recusa de envio vira falha; timeout, erro de rede ou resposta ambígua vira `UNKNOWN`. Não há retry automático de POST pago. Reservas interrompidas durante reinício também ficam incertas. Confira o painel Runway e reconcilie a tarefa com o administrador antes de qualquer nova tentativa; nesta versão não há reconciliação automática nem liberação de tarefas incertas na interface. O limite pode permanecer ocupado até revisão administrativa. Não remova registros para forçar reenvio sem conferir cobrança.

Falhas de consulta preservam a tarefa e exibem erro temporário; não disparam geração. Falhas de download não removem a tarefa nem enviam nova geração. URLs do provedor expiram: importe o resultado assim que disponível. Se expirar, consulte as opções do painel Runway; a aplicação não promete recuperar um arquivo remoto expirado.

Não foi implementado cancelamento, continuidade por imagem, áudio gerado, preço efetivamente cobrado nem reembolso. A estimativa local não é preço garantido. Mesmo uma API oficial pode ter filas, indisponibilidade, limites, moderação e variação de qualidade.

## Validação e implantação

Testes usam provedor explicitamente simulado: payload oficial, confirmação, cobrança não enviada antes da autorização, deduplicação, isolamento, limite de consultas, persistência e envio incerto. Nenhuma chamada paga é executada por testes. Sem chave/saldo e geração real autorizada, não se pode afirmar que o provedor esteja homologado.

Execute somente uma instância da API com seu volume SQLite nesta versão; não use funções efêmeras da Vercel para essa API. O frontend pode ficar na Vercel e encaminhar `/api` para um backend persistente. Para escalar, migre banco, armazenamento e coordenação de tarefas para serviços compartilhados. Estabilidade em produção ainda exige essa implantação e homologação real do provedor.

Consulte [DEPLOY_PRIVATE.md](DEPLOY_PRIVATE.md) para acesso restrito ao proprietário e [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) para resultados e riscos residuais. Nenhum limite real foi configurado nesta auditoria.
