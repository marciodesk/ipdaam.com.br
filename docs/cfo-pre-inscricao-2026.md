# Relatório da atualização da pré-inscrição CFO 2026

## Origem e escopo

- Repositório: https://github.com/marciodesk/ipdaam.com.br
- Base analisada: `f87bee23f53f53c9fb20d0e1d158e6a8dda6d742` (`main`).
- Branch de trabalho: `feat/cfo-pre-inscricao-2026`.
- O formulário existente é `inscricao.html`, compartilhado por ALFA, CFO e INC.
- O novo cronograma e o checklist se aplicam ao CFO. As datas e regras anteriores dos outros cursos foram preservadas.
- Nenhum formulário adicional foi criado. A entrega está na branch de trabalho do repositório; não houve alteração da `main`, publicação em produção, acesso ao banco de produção ou migração remota.

## Comportamento implementado

A pré-inscrição CFO abre em 16/11/2026 às 00h00 e permanece aberta até 07/12/2026 às 23h59, incluindo os segundos finais desse minuto. O bloqueio começa exatamente em 08/12/2026 às 00h00, em `America/Manaus` (04h00 UTC). A página reavalia o prazo a cada segundo, ao recuperar o foco e ao mudar de visibilidade. A API valida o período independentemente do navegador e o revalida após a leitura do banco.

A seção “Documentos necessários” contém seis caixas independentes: RG, CPF, certidão de estado civil, atestado de antecedentes criminais, carta de recomendação e comprovante de residência. É permitido salvar sem marcar nenhum documento. A ciência da apresentação à secretaria é obrigatória tanto na página quanto no backend.

Depois da gravação confirmada pela API, a página apresenta o protocolo, o período de entrega e os documentos não marcados. O protocolo é o próprio `enrollments.id` persistido; não foi criada uma segunda numeração. A entrega presencial ocorre de 19/11 a 10/12/2026, às segundas e quintas-feiras: 19, 23, 26 e 30/11; 03, 07 e 10/12.

O botão do WhatsApp usa `https://wa.me/<numero>?text=<encodeURIComponent(mensagem)>`, com o número do próprio candidato, normalizado com o código do Brasil. A mensagem segue o texto solicitado, com protocolo e pendências. Quando todos os documentos estão marcados, informa “Nenhum documento pendente.”. Se não houver telefone válido, o candidato pode informar seu próprio número na confirmação, sem bloquear ou alterar a pré-inscrição. O envio depende da ação do candidato no WhatsApp; não há disparo automático nem integração paga.

## Persistência e compatibilidade

Não há migrações necessárias. Os novos dados ficam no JSON da coluna `enrollments.payload` já existente:

| Campo | Conteúdo |
| --- | --- |
| `documentsChecklist` | Objeto com seis valores booleanos: `rg`, `cpf`, `civilStatusCertificate`, `criminalRecordCertificate`, `recommendationLetter`, `proofOfResidence`. |
| `documentsAcknowledged` | `true` após confirmação explícita. |
| `documentsAcknowledgedDate` | Data da ciência determinada pelo servidor em Manaus. |
| `submissionKey` | UUID da tentativa, usado para recuperar a confirmação em um reenvio. |

As linhas anteriores não são reescritas ou preenchidas retroativamente. O CFO continua sendo criado como “Em espera”, e a regra dos três anos de batismo continua vigente. O servidor determina a data e o semestre do CFO, impedindo que uma data/período forjado contorne a regra de CPF por semestre.

A proteção contra repetição atua na página (envio em andamento e conclusão) e em uma instrução atômica `INSERT ... SELECT ... WHERE NOT EXISTS` no banco. O reenvio com a mesma chave, CPF, semestre e curso recupera o identificador persistido e o checklist original. Outra tentativa para o mesmo CPF/semestre é rejeitada. A consulta anterior à gravação continua reconhecendo os registros legados que inferem o semestre pela data. A recuperação não disponibiliza uma consulta pública de candidatos por CPF.

O único ajuste na secretaria preserva esses quatro campos durante o salvamento existente. Não foram alteradas autenticação, permissões, situações, captura de foto, ativação de matrícula, rotas administrativas, presença ou notas.

## Arquivos modificados e adicionados

| Arquivo | Alteração |
| --- | --- |
| `inscricao.html` | Cronograma CFO, checklist, ciência, confirmação, protocolo, pendências, WhatsApp e bloqueio de cliques repetidos. |
| `functions/api/public-enrollments/index.js` | Validação de prazo/ciência, normalização dos novos dados, período oficial, confirmação e proteção atômica contra duplicidades. |
| `secretaria.html` | Preservação dos quatro campos novos no salvamento existente. |
| `tests/helpers.mjs` | Banco SQLite em memória, relógio controlado e servidor local para os handlers reais. |
| `tests/public-enrollments.test.mjs` | Testes de API, concorrência, histórico e autorização administrativa. |
| `tests/browser.test.mjs` | Testes do formulário, WhatsApp, responsividade e efetivação pela secretaria. |
| `tests/README.md` | Instruções para repetir a validação local. |
| `docs/cfo-pre-inscricao-2026.md` | Este relatório. |

## Resultados de validação

Ambiente: Node.js 24.22.1, Playwright 1.62.1, Chromium local e Wrangler 4.162.0.

| Verificação solicitada | Resultado |
| --- | --- |
| Abertura/encerramento | Aprovado na API e no navegador: instante anterior à abertura, abertura exata, último milissegundo permitido e bloqueio às 00h00 de 08/12 em Manaus. Inclui requisição que atravessa o prazo. |
| Checklist independente | Aprovado para cada um dos seis documentos; valores booleanos normalizados pelo servidor. |
| Documentos pendentes | Aprovado com checklist vazio, parcial e completo. |
| Protocolo | Aprovado: é igual ao ID persistido e permanece o mesmo após reenvio com resposta perdida. |
| WhatsApp | Aprovado: destino do candidato, texto completo, protocolo, pendências e codificação; clique interceptado sem envio externo. |
| Dispositivos móveis | Aprovado no Chromium com larguras de 320, 390, 768 e 1280 px; sem rolagem horizontal e com botão de pelo menos 44 px de altura. |
| Cliques/solicitações repetidas | Aprovado: oito eventos de envio durante requisição lenta produzem um cadastro; concorrência com duas leituras anteriores ao INSERT também produz uma única linha. |
| Efetivação pela secretaria | Aprovado: foto continua obrigatória na interface; a ativação autenticada preserva ID/checklist/ciência/chave. A API administrativa continua funcionando após o encerramento público, com bloqueio para acesso não autorizado. |
| Histórico e outros cursos | Aprovado com registros sintéticos legados, inclusive datas anteriores e CPF no mesmo semestre; ALFA e INC mantêm o comportamento anterior. |
| Compilação | Pages Functions compiladas com sucesso no Wrangler, sem deploy. |

Resultado agregado: **25 testes de backend e 7 testes de navegador aprovados (32 no total)**. `git diff --check` sem erros.

Limites da verificação: banco SQLite local adaptado à interface D1, sem consultar o D1 de produção; testes móveis por emulação no Chromium, sem aparelho físico/iOS; WhatsApp validado pela URL e pelo clique interceptado, sem envio real; fluxo da secretaria exercitado com referência sintética de foto, sem acessar R2 ou câmera real.

## Preparação para publicação

Os arquivos de frontend e a Function pública precisam ser publicados de forma coordenada, pois o formulário depende dos campos `ok`, `id`, `protocol` e `documentsChecklist` da nova resposta. O backend passa a exigir ciência documental no CFO, inclusive para versões antigas da página que permanecerem abertas; nesse caso, recarregar o formulário atualizado.

O repositório já direciona `inscricao.html`, quando hospedado em `ipdaam.com.br`, para `https://matriculasetdaam.pages.dev/api/public-enrollments`. Essa integração foi preservada. Na publicação autorizada, é necessário atualizar a Function nesse projeto Pages e o frontend do domínio, mantendo os bindings DB/PHOTOS e as variáveis existentes.

Nenhum comando de migração é necessário. Após a autorização expressa de publicação, verificar as páginas no domínio e o bloqueio anterior à abertura, sem criar cadastro fictício no banco real.
