# Pacote local reproduzível para Cloudflare Pages

Preparação baseada em `2d20801ba53e7641cdbfe99047810596f8bcad67`. Não publica, não aplica migrações, não consulta APIs e não carrega credenciais. Usa somente módulos nativos do Node.js; não há instalação de dependências nem scripts npm.

## Executar localmente

```powershell
node scripts/build-pages.cjs
node tests/pages-package.cjs
```

`scripts/pages-files.json` enumera individualmente os 41 arquivos públicos e os 14 arquivos de Functions necessários à release consolidada. Não há cópia recursiva genérica da raiz nem inclusão automática de arquivos novos. Alterações de lista exigem revisão. Referências públicas, preloads em `_headers` e imports relativos das Functions são verificados antes de gerar a saída.

## Saída

```text
build/pages/public/       HTML, CSS, JavaScript público, imagens, CNAME e _headers
build/pages/functions/    fontes das Functions, fora da pasta pública
build/pages/manifest.json caminhos, tamanhos e SHA-256, fora da pasta pública
build/pages/.ipdaam-generated identificador de saída gerada
```

Os arquivos de texto publicados e das Functions são codificados em UTF-8 com LF. As imagens/binários permanecem intactos. O manifesto tem ordenação determinística, sem data, caminho absoluto, ambiente ou segredo, e é idêntico em checkouts LF/CRLF.

O build recusa caminhos inseguros, arquivos sensíveis na lista, links simbólicos/junctions, Functions não revisadas e dependências ausentes. Recusa saídas previamente existentes sem seu identificador ou com arquivos inesperados. Não faz limpeza recursiva, não apaga arquivos do usuário e não elimina silenciosamente resíduos: exige revisão manual antes de continuar.

SQL, migrations, credenciais, banco local, documentação, testes, configuração do Wrangler, ferramentas e arquivos temporários não integram a pasta pública. `_headers` é entregue ao Pages para processamento; Functions são compiladas pelo Pages e não devem ser servidas como assets.

## Integração futura, ainda não autorizada

O comando de build proposto é `node scripts/build-pages.cjs`, com saída pública `build/pages/public`. No fluxo Git do Pages, a pasta original `functions/` continua na raiz do projeto, sem alterações. A cópia em `build/pages/functions/` também permite revisar o pacote completo separadamente. Nenhuma configuração remota ou arquivo Wrangler de produção foi criado ou alterado nesta preparação.

O `build/` inteiro é local e ignorado. Manifestos, relatórios, marcadores e artefatos de compilação nunca devem ser movidos para a pasta pública. Antes de integração remota, comparar novamente o manifesto e os bindings, revisar as exclusões e obter autorização específica. Não há comando de deploy, push, merge ou migração neste processo.

## Diferenças conhecidas e limites

Esta etapa integra seletivamente as melhorias locais autorizadas de Secretaria, Dashboard, Presença, Boletim, Inscrição e Termo. Os oito assets adicionais estão enumerados na lista pública. Após confirmação institucional de média mínima 6, o limite de aprovação no fluxo de professor de `functions/api/gradebook/index.js` foi alinhado ao formulário da Secretaria. As demais Functions, a autenticação e as migrações permanecem iguais à release de referência. O comparativo contra o manifesto arquivado da implantação `cf7b3454-71f3-40a1-aa8c-d3d243306d74` distingue alterações funcionais de diferenças apenas em CRLF/LF; hashes de texto podem mudar pela normalização de finais de linha. O relatório dessa comparação fica fora dos assets públicos.

Foram integradas as correções de aceite ao imprimir o Termo, seleção exata de ano/semestre do Boletim e uso exclusivo de mesma origem na Presença. Secretaria e Dashboard também deixaram de usar a API de produção quando abertos por `file:`; a Inscrição mantém seu roteamento específico do domínio publicado, sem fallback por `file:`. O acesso local deve ocorrer por HTTP.

A média mínima de aprovação é 6 no formulário da Secretaria e no fluxo de professor do backend, conforme confirmação do responsável. Foram mantidos o cálculo aritmético, os limites de nota e os estados existentes abaixo de 6: a Secretaria conserva sua classificação de recuperação, enquanto o fluxo de professor mantém “Em andamento”. Nenhum registro salvo foi recalculado ou atualizado. Declarações de conclusão continuam dependendo da validação administrativa e documental já exigida pela API; aprovação semestral não comprova conclusão integral.

Validação local: os oito testes solicitados, build repetido com SHA-256, compilação offline das Functions e Chrome com dados fictícios e APIs simuladas. Os 55 arquivos do pacote não incluem testes, SQL ou documentação. Os relatórios e PDFs de teste ficam fora da pasta pública. O commit local dos 26 arquivos foi autorizado separadamente; migração, sincronização remota e publicação não estão autorizadas.

Pendência para publicação: WhatsApp `+55 92 99475-3703` está **PENDENTE DE CONFIRMAÇÃO**. O número foi preservado; a página não contém link de destino para esse contato e mostra um botão desabilitado. A ativação/publicação do link depende de nova validação explícita do número.
