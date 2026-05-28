# ipdaam.com.br

Site estatico com inscricao publica e painel de matriculas ETDA Manaus.

## Cloudflare Pages

O formulario publico fica em `inscricao.html`.
O painel protegido da secretaria fica em `secretaria.html`.
As duas paginas usam Cloudflare Pages Functions e D1.

Variaveis/bindings obrigatorios:

- `ADMIN_PASSWORD`: senha usada pela secretaria para abrir `secretaria.html`.
- `USER_PASSWORD`: senha de usuario para acessar cursos e presenca, sem liberar a secretaria.
- `SESSION_SECRET`: segredo opcional para assinar os cookies de sessao. Se nao existir, o sistema usa `ADMIN_PASSWORD`.
- `DB`: binding D1 apontando para o banco de matriculas.
- `PHOTOS`: binding R2 para armazenar fotos dos candidatos.

Crie a tabela do banco usando `migrations/0001_create_enrollments.sql`.

O arquivo `wrangler.example.toml` serve como modelo. Copie para `wrangler.toml` apenas quando tiver o `database_id` real do D1.
