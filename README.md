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

## Chamada nominal

Em `presenca.html`, selecione data, curso e módulo (CFO). A lista considera matrículas ativas.
Salve a situação de cada aluno; pendentes só recebem falta após confirmar **Finalizar chamada**.
A busca filtra a visualização, mas o fechamento e o CSV consideram a turma completa.
O fechamento verifica se a lista mudou e preserva os registros já salvos.
As APIs mantêm as permissões por curso/módulo e registram alterações em `attendance_audit`.
Os índices de `migrations/0005_attendance_query_indexes.sql` também são criados automaticamente pela API.

Verificação local (Node com `node:sqlite`):

```sh
node tests/attendance-query.cjs
node tests/roll-call-query.cjs
node tests/attendance-client.cjs
```
