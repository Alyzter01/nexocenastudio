# NEXOCENA STUDIO — prontidão para implantação privada

**Classificação: APROVADO PARA HOMOLOGAÇÃO.** Testes locais e simulados atendidos; não há evidência suficiente para aprovar implantação privada ou produção real. Não recomendar merge baseado apenas neste relatório: CI remoto, revisão e verificações operacionais permanecem pendentes.

Escopo: branch `develop/web-runway-gen45`, base auditada `b42c9519603b37b9d493333bd961428db7781f97`, PR informado pelo proprietário: https://github.com/Alyzter01/nexocenastudio/pull/2. Somente web responsiva, sem Android/Capacitor/APK. Nenhum dado existente foi excluído, nenhuma migração de banco foi feita, nenhuma conta administrativa real foi criada e nenhuma geração paga foi executada.

## GitHub Actions e evidências remotas

As consultas `gh pr view 2` e `gh run list --branch develop/web-runway-gen45` retornaram Forbidden ao acessar api.github.com. Portanto **estado, draft/merge, checks, conclusões e logs do PR #2 não puderam ser consultados**. Não há evidência de um erro específico no workflow remoto para reproduzir; não foi inventada uma causa de CI. A branch remota foi consultada via Git. O workflow versionado já executa npm ci, typecheck, testes, Chromium e build; o build agora também compila a API. Não foi criado outro PR, nem habilitado merge automático.

O envio de um commit à mesma branch atualiza seu conteúdo remoto, mas a confirmação de que o PR #2 usa essa branch e de quais checks foram disparados exige acesso posterior à API/interface GitHub. O resultado do push e hash são apresentados no chat, sem presumir aprovação de CI.

## Achados, severidade e correções

| Severidade | Evidência anterior | Correção efetiva / estado |
| --- | --- | --- |
| Crítica | Nenhuma falha crítica comprovada nesta auditoria limitada | Não equivale a certificação ou ausência garantida de vulnerabilidades |
| Alta | Cadastro público e sessões de qualquer conta permitidos por padrão | Modo privado padrão, owner obrigatório, cadastro 403 e bloqueio de outras contas existentes sem apagá-las; multiusuário continua disponível por configuração explícita |
| Alta | Geração era habilitada somente por chave/tarifa, sem teto global persistente | Chave/tarifa não bastam: opt-in RUNWAY_GENERATION_ENABLED; reserva transacional e teto global de créditos estimados em 24h, zero bloqueia envio; sem configurar valores reais |
| Alta | Importação só verificava allowlist/HTTPS, permitindo configuração de host privado | Rejeita IP literal, credenciais, protocolos, localhost; DNS deve resolver somente endereços públicos, com timeout e bloqueio de redes especiais. Redirects continuam proibidos. Residual DNS rebinding exige egress seguro na hospedagem |
| Média | Upload confiava apenas no MIME declarado; falha podia deixar arquivo parcial | MIME + assinatura básica de contêiner e limpeza em falha; arquivos novos privados. Não substitui antivírus/decodificação completa |
| Média | Update de projeto e histórico eram gravados separadamente | Transação SQLite com rollback testado por falha deliberada no histórico |
| Média | Projeto podia referenciar UUID de mídia alheia e cenas com IDs repetidos | Verificação de propriedade da mídia, rejeição de aprovação sem mídia e IDs de cena duplicados |
| Média | Registro da mídia importada e vínculo do job eram independentes | Transação conjunta e bloqueio rechecado após DNS assíncrono para reduzir importações duplicadas |
| Média | Instruções de backup eram somente cópia manual | Script com backup SQLite, mídias referenciadas, SHA-256 e marcador INCOMPLETE; restauração de projeto/sessão/mídia em diretório temporário aprovada |
| Média | Produção usava entrada TypeScript dependente do runner de desenvolvimento | Build separado da API, execução de JS compilado e parada graciosa SIGTERM/SIGINT; smoke real local aprovado |
| Média | Exceções podiam ser serializadas integralmente no log | Erros HTTP genéricos, logs sem mensagem arbitrária de exceção, sem querystring e com redaction de auth/cookie; Cache-Control no-store e headers básicos |
| Baixa | Cadastro aparecia mesmo em instalação privada | UI consulta configuração pública mínima e esconde criação de conta por padrão |
| Baixa | Polling de sucesso apagava mensagem de erro de ação; modal não mantinha foco | Erros de polling separados; modal foca Cancelar, contém Tab e permite Escape quando não está enviando |

## Integração Runway: revisão do contrato

Fontes oficiais consultadas por HTTPS público nesta auditoria:

- https://github.com/runwayml/sdk-node/blob/main/src/resources/text-to-video.ts
- https://github.com/runwayml/sdk-node/blob/main/src/resources/tasks.ts
- https://github.com/runwayml/sdk-node/blob/main/src/client.ts (referência da integração)

O código público de text_to_video confirma `model: gen4.5`, duração inteira 2–10s, prompt de até 1.000 unidades UTF-16 e `1280:720`/`720:1280`. Tasks documenta os seis estados usados e não esperar atualização mais frequente que cinco segundos. Não foi identificada divergência nesses campos. O adaptador usa rota fixa oficial, credencial exclusivamente backend, timeout de 30s e redirects bloqueados. Nenhum outro modelo é escolhido silenciosamente.

POST pago não tem retry automático; timeout, rede, HTTP 408/5xx e respostas sem confirmação entram em UNKNOWN. Respostas 4xx restantes são recusa. Job é reservado antes do envio, deduplicado pela estimativa e limitado a dois ativos por usuário/um por cena. Reinício em SUBMITTING é tratado conservadoramente como UNKNOWN. Uma instância SQLite é o limite operacional suportado. A consulta remota continua dependendo de o painel estar aberto; a execução remota não depende disso.

Estimativas não são fatura nem teto garantido do provedor: tarifa pode mudar, falha pode cobrar e o app não lê custo real. O teto local é conservador, conta todas as reservas e não libera supostos reembolsos. Antes de qualquer autorização real, configurar também os limites financeiros e alertas disponíveis no provedor. Isso **não foi feito** nesta auditoria.

## Validações realmente executadas nesta auditoria

| Comando / teste | Evidência |
| --- | --- |
| npm ci --no-audit --no-fund | 118 pacotes instalados pelo lockfile, exit 0; flags só omitem relatório/funding |
| npm run typecheck | Aprovado após as correções |
| npm test | 12 testes aprovados, zero falhas no conjunto final |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e | 3 testes aprovados, zero falhas |
| npm run build | API/CLIs emitidas por TypeScript e frontend Vite compilado, exit 0 |
| npm audit --omit=dev --json | 0 advisories nas dependências de produção nesta consulta; não é auditoria completa de supply chain |
| npm run start:api em diretório temporário, modo production/private | HTTP 200 em health, SQLite responde, Runway indisponível; processo encerrado após smoke |
| Backup/restore e owner CLI | Exercitados somente em diretórios e contas de fixture; dados reais não foram usados |
| Geração/importação reais Runway | Não executadas; toda geração dos testes é simulada |
| Checks/logs GitHub Actions | Não consultáveis por Forbidden; nenhum resultado remoto alegado |
| Deploy, certificado real, disco da hospedagem, cron de backup | Não executados/configurados |

Os testes de segurança cobrem bloqueio de cadastro/conta não autorizada, cookies Secure/HttpOnly/SameSite, origem indevida, isolamento, MIME falso e limpeza, mídia estrangeira, IDs duplicados, rollback de histórico, SSRF, backups e provisionamento que não sobrescreve conta existente. Vídeo cobre contrato, duração inválida, ausência de provedor, confirmação, deduplicação, limite de consulta, persistência, envio incerto, teto financeiro e importação inválida/host não permitido. Os testes Chromium cobrem AutoSave/reload, projeto vazio, viewports 320×640, 390×844, 844×390 e 1440×900, foco/Tab, confirmação de custo, tarefa recuperada sem reenvio e UI privada. A configuração do servidor E2E explicitamente habilita contas de fixture e remove a chave/tarifa da Runway.

Não houve falha de instalação, TypeScript, teste ou build reproduzida do CI remoto, pois seus logs estavam indisponíveis. As correções foram motivadas pela inspeção de código e regressões locais com falhas injetadas. Não foram desabilitadas asserções ou contornadas restrições de acesso.

## Persistência e dados

SQLite/WAL e disco privado mantidos, sem migração ou substituição. busy_timeout e transações protegem escritas relacionadas. Mídias existentes não foram alteradas. Mudanças de configuração de acesso não apagam usuários/sessões/projetos; apenas restringem a autenticação ao proprietário. Novos diretórios/arquivos sensíveis usam permissões restritas; permissões de volumes preexistentes precisam ser verificadas pelo operador.

Backup usa API de backup SQLite e copia somente objetos referenciados no snapshot. Depende de mídias imutáveis e de não haver deleção física concorrente. Falha deixa INCOMPLETE; não sobrescreve destino. Manifesto SHA-256 detecta corrupção acidental, não substitui assinatura, criptografia ou controle de acesso. Ensaio em fixtures aprovado; backup real agendado e restauração operacional continuam pendentes. Rollback de snapshot não desfaz tarefas/cobranças remotas: reconciliação obrigatória antes de reenviar.

## Arquitetura recomendada e custos de planejamento

Frontend na Vercel; API Node 24/Fastify em serviço persistente com HTTPS; uma instância, volume durável para SQLite/mídias e backup externo criptografado. Exemplo tecnicamente compatível: serviço pago Render com persistent disk, ou VM administrada. Não escolher plano gratuito/efêmero para dados. Use rewrite externo `/api` na mesma origem e teste upload de 100 MB; não introduzir função proxy serverless com limite de corpo incompatível. Passos, variáveis, verificações e rollback estão em DEPLOY_PRIVATE.md.

**Estimativas abaixo são cenários de orçamento, não preços atuais verificados ou cotações.** Os preços atuais dessas páginas não foram verificados nesta auditoria; confirmar elegibilidade, valores, impostos, câmbio, egress e condições antes de contratar. Fontes oficiais para cotação: https://vercel.com/pricing, https://render.com/pricing, https://render.com/docs/disks. Nenhum serviço foi contratado.

| Componente | Premissa / reserva mensal ilustrativa em USD |
| --- | --- |
| Vercel | US$0 somente se o plano gratuito for permitido para o uso pretendido; reservar US$20–30 se houver necessidade de plano pago. Confirmar termos para uso comercial |
| Backend persistente | Reservar US$7–25 para serviço pequeno de uma instância. Medir RAM/CPU e subir plano se necessário |
| Disco de 10 GB | Reservar US$2–5; confirmar unidade/valor real do provedor |
| Backup externo/egress | Reservar US$1–10 para baixo volume; pode crescer com transferência e retenção |
| Total de infraestrutura | Cenário gratuito elegível no frontend: US$10–40; cenário com frontend pago: US$30–70, sem impostos/domínio/IA |
| Runway | Não estimado sem volume, tarifa atual e conta autorizada; manter desabilitada. Crédito de API não é crédito Flow |

Premissa de armazenamento: 100 vídeos de 50 MB ≈ 5 GB, mais originais, banco, margem e cópias temporárias. São hipóteses, não tamanho observado de geração real. Um disco de 10 GB pode esgotar rapidamente. Backups devem ficar fora desse volume e alerta deve preceder esgotamento. Sem vídeos renderizados localmente, a API atual faz I/O e autenticação; ainda assim memória e limites de processo exigem medição no host real.

PostgreSQL/S3 são proposta futura, não migração recomendada imediatamente para um único proprietário. Antes de migrar: estimar custo mensal adicional, exportar com consistência, validar schema/contagens/hash de objetos, ensaiar, congelar escritas, trocar conexão e manter SQLite/volume original intactos para rollback. Não escalar réplicas com SQLite local.

## Riscos e requisitos que impedem aprovação para implantação privada agora

1. Verificar checks e logs do PR #2 e obter revisão humana de código; acesso remoto à API GitHub está bloqueado.
2. Validar rede/egress contra DNS rebinding: a resolução de DNS é prévia e não fixa o IP da conexão; não liberar host arbitrário e exigir barreira de rede contra endereços privados. Residual de severidade média neste cenário de owner único/URLs de provedor; não declarar SSRF eliminada.
3. Homologar domínio, HTTPS, rewrites, cookies, headers CSP, uploads e playback reais na Vercel/backend, sem deploy autorizado nesta etapa.
4. Configurar volume, permissões, agendamento de backup, criptografia offsite, retenção e ensaio real de restore/rollback. Nenhum destes controles operacionais está implantado.
5. Prover owner via manutenção segura, sem credencial fixa; acesso/recuperação de senha offline ainda exige operação controlada. Scrypt existente e salt aleatório mantidos; custo do hash e latência devem ser reavaliados antes de abrir multiusuário. Sessões expiram em sete dias; MFA e revogação global não foram implementados.
6. Assinatura básica de upload/MP4 não é antivírus, FFprobe completo ou garantia de codec. Homologar arquivos reais e limites de memória/tempo/disco. Range/seek de mídia ainda depende de comportamento não homologado no deploy.
7. Orçamento é estimado; reconciliação de UNKNOWN e de custo efetivo é manual. Nenhuma geração paga deve ser liberada antes de homologação autorizada e teto no provedor.
8. Cache local usa localStorage e guarda rascunhos em texto no dispositivo; usar dispositivo confiável. Ainda não há IndexedDB, recuperação de senha ou monitoramento externo implantado. Renderização FFmpeg de montagem continua indisponível.

Próximo passo: restaurar acesso de leitura ao GitHub, revisar o PR/checks, preparar uma homologação privada com IA desabilitada e executar o roteiro operacional. Isso não autoriza publicação ou cobrança. **Sem merge, deploy ou homologação real nesta entrega.**
