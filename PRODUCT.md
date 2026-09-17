# Product

<!-- impeccable:product-schema 1 -->

**Regra principal:** preservar primeiro os fluxos e regras existentes; melhorar a apresentação sem alterar silenciosamente o funcionamento do sistema. Esta regra prevalece sobre decisões de apresentação. Mudanças funcionais devem ser explicitadas e estar dentro do escopo autorizado.

## Platform

web

## Users

Interessados nos cursos e alunos são o público prioritário nas decisões futuras, conforme confirmação do responsável pelo projeto.

As áreas de secretaria e gestão acadêmica atendem também à equipe interna, conforme os perfis e as permissões implementados. Essa função de apoio preserva a prioridade confirmada para interessados e alunos.

Muitos usuários acessam pelo telefone. O produto também deve atender pessoas com pouca familiaridade com tecnologia.

## Product Purpose

No contexto deste projeto, o IPDAAM é o portal digital utilizado pela Igreja Pentecostal Deus é Amor no Amazonas para divulgação, inscrições e serviços relacionados às atividades de formação.

A ETDA Manaus é a frente de ensino/formação que utiliza esse portal para organizar cursos, inscrições e acompanhamento dos alunos. Essa relação institucional foi confirmada pelo responsável pelo projeto.

O portal deve permitir que interessados e alunos encontrem informações e utilizem os serviços de formação, apoiados pelas rotinas acadêmicas e administrativas existentes. Metas quantitativas específicas de sucesso ainda não foram definidas.

## Operating Context

Contexto técnico observado no repositório:

- `index.html`: informações públicas sobre cursos, calendário e contato.
- `inscricao.html`: formulário público de inscrição.
- `secretaria.html`: gestão de matrículas e boletim acadêmico.
- `cursos.html`, `presenca.html` e `notas.html`: consultas e rotinas acadêmicas protegidas por acesso.
- `cadastro-presenca.html`: solicitação de acesso aos cursos e módulos.
- `usuarios-presenca.html`: aprovação e gestão de usuários, responsabilidades e redefinição administrativa de senhas.
- `trocar-senha-presenca.html`: troca de senha da própria conta.
- `README.md`: documenta Cloudflare Pages Functions, banco D1 e armazenamento de fotos R2.

## Capabilities and Constraints

Regras confirmadas para qualquer trabalho futuro:

- Preservar os fluxos existentes de inscrição, cursos, presença, notas, secretaria, usuários e troca/recuperação de senha, respeitando os mecanismos já implementados. O código atual evidencia troca pela própria conta e redefinição administrativa; não se presume um fluxo adicional de recuperação automática.
- Não alterar nomes de campos, rotas, IDs, integrações, banco de dados ou regras de negócio apenas por motivo visual.
- Manter compatibilidade com os dados e cadastros já existentes.
- Manter as áreas administrativas protegidas conforme as permissões e os perfis já implementados.
- Não expor informações pessoais, credenciais, tokens ou dados administrativos em páginas públicas.
- Preservar funcionalidade e comportamento existentes em mudanças de interface.
- Antes de remover ou substituir qualquer componente, verificar se ele participa de algum fluxo, evento JavaScript, integração ou regra de negócio.
- Realizar melhorias visuais incrementais; não reconstruir a aplicação sem necessidade.

## Brand Commitments

- Preservar o nome IPDAAM e a identidade institucional já existente.
- Preservar a identificação da ETDA Manaus como área de formação/ensino neste contexto.
- Manter aparência de comunidade e formação cristã: acolhedora, organizada e sóbria, sem aparência comercial, de loja ou de publicidade.
- Usar linguagem clara, respeitosa e adequada ao ambiente cristão e educacional.
- Evitar efeitos visuais excessivos, animações desnecessárias e elementos que dificultem o uso por pessoas com pouca familiaridade com tecnologia.

`DESIGN.md` registra a expressão confirmada "Comunidade de formação" e os padrões visuais existentes. Os compromissos institucionais acima orientam a aplicação desses padrões.

## Evidence on Hand

- `README.md` e páginas HTML: evidências das funcionalidades atuais, não confirmação de novas regras de produto.
- `assets/logo/`: imagens existentes de identidade.
- `assets/banners/`: fotografias existentes.

As escolhas e restrições institucionais deste documento foram confirmadas pelo responsável pelo projeto. As referências ao código descrevem a implementação observada, sem afirmar que ela já atende integralmente aos requisitos de acessibilidade abaixo.

## Product Principles

1. Aplicar a regra principal acima: preservar os fluxos, regras, comportamentos, integrações e dados existentes ao melhorar a interface de forma incremental.
2. Priorizar interessados e alunos na clareza das informações e no acesso aos serviços de formação.
3. Preservar a identidade cristã e educacional e uma comunicação acolhedora, organizada e sóbria.
4. Respeitar os limites entre acesso público e administrativo, preservando permissões e privacidade.
5. Atender celular e desktop com legibilidade, acessibilidade e facilidade de uso.

## Accessibility & Inclusion

- Funcionar bem em celular e desktop, considerando o uso frequente pelo telefone.
- Manter boa legibilidade e contraste.
- Permitir navegação por teclado e manter o foco visível.
- Manter labels de formulários associados aos respectivos campos e áreas de toque adequadas.
- Evitar excesso de efeitos e animações que dificultem a compreensão ou a execução das tarefas.
- Considerar usuários com pouca familiaridade com tecnologia na linguagem e nas interações.

Esses requisitos orientam as melhorias futuras; não representam uma declaração de conformidade da implementação atual.
