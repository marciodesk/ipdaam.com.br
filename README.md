# ipdaam.com.br

Site estatico com painel de matriculas ETDA Manaus.

## Cloudflare Pages

O painel em `inscricao.html` usa Cloudflare Pages Functions e D1.

Variaveis/bindings obrigatorios:

- `ADMIN_PASSWORD`: senha usada pela secretaria para abrir o painel.
- `DB`: binding D1 apontando para o banco de matriculas.

Crie a tabela do banco usando `migrations/0001_create_enrollments.sql`.

O arquivo `wrangler.example.toml` serve como modelo. Copie para `wrangler.toml` apenas quando tiver o `database_id` real do D1.
