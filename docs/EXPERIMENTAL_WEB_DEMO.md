# NEXOCENA STUDIO — prévia visual Vercel

## Endereço de prévia
É criado automaticamente **apenas quando** a Vercel compila esta branch via integração Git. O URL deve ser obtido no status READY da Vercel: não adivinhar URL.

## Isolamento
- Exatamente a branch `experiment/cloudflare-pages-workers-d1` habilita a demo com `VERCEL_GIT_COMMIT_REF` no build.
- A compilação injeta `VITE_NEXOCENA_PREVIEW_DEMO=true` e `VITE_NEXOCENA_EXPERIMENTAL=true`.
- `apps/web/src/lib/demo-api.ts` fornece **dados fictícios** e operações locais (projetos, cenas e créditos manuais).
- O preview não possui backend, login real, D1 remoto, Cloudflare Worker remoto, uploads, geração paga, nem MP4.
- Tudo fica apenas no localStorage do navegador do visitante. Não guardar conteúdo confidencial na demo; dados podem ser apagados pelo navegador.
- O build preserva as regras antigas em outras branches: `API_ORIGIN` HTTPS continua obrigatório na publicação da aplicação completa.
- Não houve criação de recurso Cloudflare, implantação de D1 ou alteração na branch `main`.

## Validação
- Verificar GitHub CI, Vercel deployment status READY e resposta no endereço HTTPS antes de compartilhar.
- Testar em Android, navegar dashboard/cenas/montagem/ajustes, editar cenas e exportar JSON.
- Como não há persistência remota, o preview não equivale à homologação do backend e seus dados não são transportados para produção.

## Segurança
A demo é somente para **inspeção de interface**. Desative o link ou use Deployment Protection caso não deseje que visitantes vejam a estrutura visual. Nunca misture variáveis de produção no build da demo.
