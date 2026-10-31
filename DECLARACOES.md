# Declarações — operação e publicação

Rota: `/declaracoes`. Acesso exclusivo às contas administrativas já autorizadas pela Secretaria; a API verifica a permissão em cada consulta e emissão. A navegação compartilhada inclui o link apenas para esse perfil.

## Critérios pendentes de homologação

Não foram fornecidos: matriz integral de cada curso, carga horária, frequência mínima, notas mínimas de integralização, atividades e demais exigências, autoridade competente para homologar e assinar, referência institucional e confirmação documental do certificado pendente. Não há critérios oficiais nem validações semeados nesta implementação.

Há divergências existentes que não foram modificadas: a secretaria usa média 6 para aprovação e 5 para recuperação; o fluxo de professores na API usa 7 para aprovação e limita a nota a 10. A secretaria não aplica esse limite. Um boletim de semestre aprovado não comprova integralização.

A declaração de conclusão fica bloqueada até existir política homologada, confirmação explícita da Secretaria e comprovação de todos os módulos, carga horária, frequência e demais requisitos. Os valores da política precisam ser definidos institucionalmente; o código não escolhe esses critérios. A API não aceita sinalizadores enviados pelo navegador como homologação. A tela não oferece atalhos para cadastrar políticas ou aprovar conclusão enquanto essas definições estiverem pendentes.

## Migração revisável

`migrations/0006_create_declarations.sql` cria:

- `declaration_course_policies`: critérios homologados e sua referência institucional, sem inserir critérios.
- `declaration_completion_validations`: atestação documental integral, responsável, data, referências de comprovação e estado do certificado.
- `declarations_issued`: documento emitido, número de controle, tipo, aluno, curso, período, data, conta emissora e nome declarado do signatário. O conteúdo é imutável para reimpressão.

A migração não altera matrículas, boletins ou presenças. Não contém dados pessoais ou aprovações de conclusão.

Aplicação exclusivamente local, mantendo a configuração existente:

```sh
npx wrangler d1 migrations apply DB --local --config wrangler.local.toml
```

Em 31/10/2026, o responsável confirmou que a migração 0006 já foi aplicada ao D1 de produção `controle-matriculas-etda`, binding `DB`, com três tabelas e dois gatilhos. **Não reaplicar essa migração em produção.** Os comandos acima destinam-se exclusivamente a bancos locais de teste. A publicação do código não exige executar migrações.

A fase futura de homologação deve definir quem pode lançar as políticas e os comprovantes, como revisar a documentação e como registrar correções ou revogações. Não há QR ou verificação pública nesta fase.

## Identidade e impressão

A conta administrativa atual pode ser compartilhada. Por isso, o nome do responsável é informado explicitamente e registrado com a conta; ele não é apresentado como identidade pessoal verificada pelo login. A instituição ainda precisa confirmar os responsáveis autorizados.

Documentos não incluem CPF, fotos, telefones nem referências privadas de comprovação. O controle é um identificador opaco, sem URL pública, mantido internamente e no histórico; a linha de controle não aparece na impressão. A reimpressão preserva o conteúdo registrado e o identificador; a data exibida no papel é a data atual de emissão da via, por extenso, no fuso America/Manaus, sem horário. A data original do registro permanece no histórico. Pré-visualizações não emitidas não produzem declarações válidas no modo de impressão.

Impressão: A4, margens de 20 mm. No Chrome, desativar **Cabeçalhos e rodapés**. Para PDF, usar **Salvar como PDF**. A declaração não substitui o certificado.

## Verificações

```sh
node tests/declarations-query.cjs
node tests/declarations-auth.cjs
node tests/gradebook-query.cjs
node tests/attendance-query.cjs
node tests/roll-call-query.cjs
node tests/attendance-client.cjs
```

O teste de declarações usa apenas SQLite em memória, com política e comprovantes expressamente fictícios. Nenhuma política de teste deve ser inserida no banco da aplicação como se fosse uma regra institucional.

## Escopo da publicação

Cloudflare Pages: `matriculasetdaam`; domínio: `ipdaam.com.br`. Preparar uma revisão isolada a partir do commit confirmado do último deploy de produção, incluindo somente o módulo e sua integração com a navegação existente. Não publicar a pasta de trabalho inteira: configurações locais, credenciais, arquivos acidentais, testes e documentação não devem ser servidos como assets públicos.

As APIs `/api/declarations` (GET/POST) e `/api/declarations/eligibility` exigem sessão administrativa no servidor, inclusive em chamadas diretas. Os testes de autorização usam cookies assinados pelo código real de autenticação, com segredo fictício em memória. Não emitir documentos de teste nem alterar matrículas em produção para validar a publicação; verificar rotas protegidas sem autenticação e testar emissão/histórico somente localmente.
