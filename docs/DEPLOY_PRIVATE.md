# Implantação privada — procedimento, ainda não executado

> Na branch develop/free-hosting-supabase, a arquitetura atual usa PostgreSQL/Supabase Storage e Render Free. Este documento contém contexto histórico; a referência de implantação atual é [FREE_HOSTING_SUPABASE.md](FREE_HOSTING_SUPABASE.md) e a evidência atual está em [FREE_HOSTING_REPORT.md](FREE_HOSTING_REPORT.md).

## Arquitetura e limites

Navegador mobile/desktop → frontend Vercel (HTTPS) → rewrite `/api/:path*` → Fastify persistente (HTTPS) → SQLite WAL e diretório de mídias em **um volume durável**, uma instância de API. A Runway é chamada somente pelo backend. Não migrar o banco atual nem usar o disco temporário de funções serverless para dados. Um serviço pago Render com persistent disk ou uma VM com disco e backup pode executar este processo; a escolha exige confirmar limites e preços atuais. Plano gratuito sem disco durável não atende. Docker não é necessário para a preparação atual.

Use um proxy de saída/firewall que bloqueie redes privadas/reservadas para downloads externos; o código faz allowlist e checagem de DNS, mas não fixa o IP entre resolução e conexão. Não aceite hostnames arbitrários de usuários. Sem esse controle de egress, a proteção contra DNS rebinding não foi homologada. Não exponha o filesystem como pasta estática.

## Preparar o backend

1. Revise o PR e CI antes de qualquer merge/deploy. Fixe o commit a implantar. Não foi feito deploy por esta auditoria.
2. Em uma máquina com Node 24 e npm, execute `npm ci` e `npm run build:api`. O comando de inicialização é `npm run start:api`; ele executa JavaScript compilado, sem servidor de desenvolvimento ou tsx no caminho da API.
3. Monte um volume fora do checkout, por exemplo `/var/data/nexocena`, pertencente ao usuário não root do serviço. Use diretórios 0700, arquivos 0600 e `umask 077`. Não compartilhe SQLite em rede NFS ou entre réplicas. Preserve arquivos WAL/SHM e mídias em reinícios. Não publique o volume como artifact.
4. Defina estas variáveis no gerenciador seguro do serviço, sem registrá-las no Git:

| Nome | Requisito |
| --- | --- |
| NODE_ENV | production |
| PORT | Porta fornecida pela hospedagem; padrão 3001 |
| DATA_DIR | Caminho absoluto do volume durável |
| ACCESS_MODE | private |
| PRIVATE_OWNER_EMAIL | E-mail autorizado do proprietário; não confere senha ou conta por si só |
| REGISTRATION_ENABLED | false; cadastro privado permanece bloqueado mesmo se true |
| APP_ORIGIN | Origem HTTPS exata do frontend, sem path/query |
| RUNWAY_GENERATION_ENABLED | false até homologação autorizada |
| RUNWAYML_API_SECRET | Chave somente backend; não configurar em VITE_* |
| RUNWAY_CREDITS_PER_SECOND | Tarifa verificada; manter ausente durante preparação sem cobranças |
| RUNWAY_DAILY_CREDIT_LIMIT | 0 durante preparação; teto global positivo apenas após aprovação financeira |
| RUNWAY_OUTPUT_HOSTS | Hostnames HTTPS públicos oficiais exatos, sem wildcard |
| NODE_USE_ENV_PROXY | 1 apenas quando o processo precisa usar proxy herdado |
| BACKUP_DIR | Destino novo e privado, fora de DATA_DIR, para cada backup |

O aplicativo não lê `.env` automaticamente. Injete pelo gerenciador do serviço. Não use credenciais ou cabeçalhos de autenticação em parâmetros de URL. A rede deve permitir API Runway e hosts de saída somente quando a geração for habilitada. Não use tráfego autenticado do Google Flow.

5. Crie a conta offline antes da exposição pública, com **o mesmo DATA_DIR e PRIVATE_OWNER_EMAIL da API**. O script recusa sobrescrever uma conta existente. Não forneça senha em argumento, histórico de shell ou variável versionada. Em terminal Bash confiável, com tracing desativado:

```sh
set +x
read -r -s -p 'Senha do proprietário (mínimo 12 caracteres): ' owner_password
printf '\n'
printf '%s' "$owner_password" | node dist/server/scripts/create-user.js
unset owner_password
```

Use senha forte em gerenciador de senhas. Não foi criada conta real pela auditoria. A recuperação automática de senha não existe; planeje manutenção offline com identidade verificada. Contas existentes e respectivos projetos não são apagados ao ativar modo privado.

6. Inicie somente uma instância. Configure parada graciosa SIGTERM, limite de memória e reinício supervisionado. Em Render, selecione runtime Node e disco persistente no ponto configurado; `npm ci && npm run build:api` como build e `npm run start:api` como start. Confirme que reinícios/deploys mantêm o disco e que a conta não usa plano efêmero. Serviços de cron separados normalmente não montam o mesmo disco: não presuma que backup em outro job enxerga DATA_DIR.

## Configurar Vercel (sem executar deploy aqui)

Importe o repositório, selecione a branch/commit revisado, raiz do monorepo, build `npm run build -w apps/web`, output `apps/web/dist`. Não coloque a chave Runway no frontend. Configure o rewrite de API para a **URL real HTTPS do backend** antes do fallback SPA. Exemplo documental; substituir a URL antes de salvar:

```json
{
  "buildCommand": "npm run build -w apps/web",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    {"source": "/api/:path*", "destination": "https://SEU-BACKEND-REAL/api/:path*"},
    {"source": "/:path*", "destination": "/index.html"}
  ]
}
```

O exemplo não é configuração ativa e não deve ser publicado com placeholder. Use rewrites externos, não uma função proxy com limite de payload menor que 100 MB. Homologue que a plataforma aceita uploads desse tamanho, preserva Set-Cookie/Range e não armazena respostas privadas. Desative cache em `/api/*` no CDN. O backend responde Cache-Control no-store e não habilita CORS externo.

Configure headers no host estático: X-Content-Type-Options nosniff; Referrer-Policy no-referrer; Content-Security-Policy restrita com default-src 'self', frame-ancestors 'none', object-src 'none', base-uri 'self', connect-src 'self', img-src 'self' blob: data:, media-src 'self' blob:. Teste no deploy real antes de aplicar permanentemente. Não configure uma política que quebre áudio/vídeo ou o service worker. Proteja também acesso a previews (ex.: proteção da hospedagem), pois não há conta especial de demonstração.

## Verificação privada antes de habilitar IA

- HTTPS e certificado válido em frontend/backend; HTTP redirecionado no edge. APP_ORIGIN deve corresponder à origem visível no navegador, inclusive domínio personalizado.
- `/api/health`: API ready e database.ok=1, sem informações de chave. Não expor diagnóstico detalhado do sistema.
- Cadastro retorna 403; conta diferente do owner não entra; cookies Secure, HttpOnly e SameSite=Lax.
- Login via domínio Vercel e criação de projeto, upload real, reprodução, AutoSave, fechamento e recarga no celular/desktop.
- Reinicie a API e confirme projeto/mídia/tarefa preservados. Não use geração paga para esse teste: teste tarefas simuladas em homologação isolada.
- Confirmar egress bloqueando IPs privados, endereços literais, URL com credencial e redirects. Confirmar limites de upload e de disco; assinatura básica não é antivírus nem decodificação completa.
- Monitore 5xx/latência, reinícios, espaço livre (alerta antes de 70–80%), falhas de backup e tarefas UNKNOWN. Logs não devem conter bodies, senhas, Authorization, cookies, URLs assinadas ou queries secretas. Rate limit atual é por endereço observado da conexão; com rewrite o limite pode ser compartilhado. Não habilite trustProxy global sem validar a cadeia de proxies.

## Backup e restauração

O comando `node dist/server/scripts/backup.js` exige DATA_DIR e BACKUP_DIR novo. Usa backup SQLite consistente e copia apenas mídias referenciadas pelo snapshot. A hipótese é que mídias são imutáveis e não são excluídas enquanto o backup está em andamento; a aplicação atual não oferece exclusão física de mídia. Não mudar essa hipótese sem coordenar backup/deleção. Se falhar, permanece INCOMPLETE: não trate esse diretório como backup válido. O destino não pode sobrescrever nem conter o diretório de origem. O manifesto contém SHA-256 para verificação de transporte, não autenticação criptográfica contra um atacante que altere o manifesto.

Agende no mesmo host/volume da API e copie o snapshot concluído para armazenamento externo criptografado, com retenção e permissões restritas. A auditoria não configurou agendamento ou backup real. Backups contêm hashes de senha, sessões e mídias privadas: nunca versionar. Meta inicial sugerida: RPO 24 horas/RTO 4 horas, a medir com restaurações reais; não é um SLA comprovado.

Para recuperar: desabilite geração, pare a API, confirme ausência de INCOMPLETE e confira cada hash do manifesto, restaure banco e mídias em **novo volume**, aponte DATA_DIR e execute verificações de login, projeto, mídia e tarefa. Não sobrescreva o volume antigo. Faça primeiro um ensaio fora de produção. Expire sessões por manutenção autorizada se o backup tiver sido exposto.

## Rollback

Guarde commit, build, configuração não secreta e backup anterior. Desabilite geração e pare a instância nova. Reimplante o build anterior compatível e use snapshot em novo volume se necessário. As mudanças atuais são aditivas no banco e não removem dados; não faça downgrade cego de schema futuro. Verifique login, revisão de projetos, mídias e tarefas antes de restaurar acesso. Tarefas SUBMITTING interrompidas viram UNKNOWN; confira o painel Runway antes de qualquer reenvio. Restaurar um backup não desfaz cobranças nem tarefas remotas. A janela entre backup e incidente precisa de reconciliação externa para evitar duplicidade.

## Custos e eventual migração

Ver estimativas com premissas e limitações em PRODUCTION_READINESS.md. PostgreSQL/S3 não são necessários para uma instância privada inicial. Antes de migrar, proponha schema compatível, cópia/verificação de arquivos e hashes, manutenção com parada de escrita, ensaio e comparação de contagens; mantenha SQLite/volume intactos e somente leitura para rollback. Não foi feita migração nem contratação de serviço.
