# Testes da pré-inscrição CFO 2026

Requer Node.js 24 (usa `node:sqlite`). Os testes não usam o banco remoto, credenciais reais, R2 ou dados de candidatos. A suíte de navegador executa os handlers reais de Pages Functions em um servidor de testes limitado a `127.0.0.1`, com SQLite em memória adaptado à interface D1. As navegações para o WhatsApp são interceptadas antes de alcançar o serviço externo.

## Abrir no VS Code

No terminal do seu VS Code, dentro do repositório, selecione a branch de publicação:

```sh
git fetch origin
git switch release/cfo-pre-inscricao-2026
git pull --ff-only
node tests/preview.mjs
```

Abra `http://127.0.0.1:4173/inscricao.html` no navegador do mesmo computador. Não é necessário instalar dependências ou autenticar na Cloudflare. O formulário e a API usam os arquivos reais da branch, com SQLite em memória e relógio simulado, limitado a esta prévia. Nenhum arquivo da aplicação é reescrito para simular as datas.

Use dados fictícios e selecione um dos três cenários no topo: antes da abertura, inscrições abertas ou após o encerramento. A opção “Limpar cadastros fictícios” permite começar novamente com o mesmo CPF de teste. Ctrl+C encerra o servidor e descarta os dados. As rotinas administrativas e R2 não fazem parte desta prévia manual. O WhatsApp da prévia abre somente por ação do usuário, com a mensagem preenchida.

Se a porta estiver ocupada, configure `CFO_PREVIEW_PORT` antes de iniciar o comando. Não use apenas Live Server para testar o envio: a API de teste é fornecida pelo comando acima.

## Validação automatizada

Backend, sem dependências adicionais:

```sh
node --test tests/public-enrollments.test.mjs
```

Navegador, com Playwright 1.62.1 e Chromium disponíveis:

```sh
PLAYWRIGHT_MODULE=/caminho/para/playwright/index.mjs \
CHROMIUM_PATH=/caminho/para/chromium \
node --test --test-timeout=60000 tests/browser.test.mjs
```

Se Playwright estiver instalado e puder ser importado normalmente no projeto, omita `PLAYWRIGHT_MODULE`. Se estiver usando o Chromium gerenciado pelo Playwright, omita `CHROMIUM_PATH`. A variável opcional `CFO_SCREENSHOTS` define onde salvar evidências visuais de teste.

Os testes usam relógio controlado, inclusive com o dispositivo configurado no fuso de Tóquio, e exercitam os limites de Manaus. A suíte também força duas requisições a lerem a ausência de cadastro antes de ambas tentarem gravar, verificando o bloqueio atômico de duplicidades.

Compilação local das Functions (sem implantação):

```sh
npm exec --yes --package=wrangler@4.162.0 -- \
  wrangler pages functions build --outdir ../cfo-functions-build
```

Não executar comandos de deploy nem migrações remotas como parte desses testes.
