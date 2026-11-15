# Testes da pré-inscrição CFO 2026

Requer Node.js 24 (usa `node:sqlite`). Os testes não usam o banco remoto, credenciais reais, R2 ou dados de candidatos. A suíte de navegador executa os handlers reais de Pages Functions em um servidor de testes limitado a `127.0.0.1`, com SQLite em memória adaptado à interface D1. As navegações para o WhatsApp são interceptadas antes de alcançar o serviço externo.

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
