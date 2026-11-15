import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createDb, setTestNow, restoreClock, startTestServer, savedRows, candidate, documentKeys } from "./helpers.mjs";
import { createSessionCookie } from "../functions/api/_auth.js";
import { envPasswords } from "./helpers.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
let browser;
let db;
let server;
before(async () => {
  setTestNow("2026-11-20T12:00:00Z");
  db = await createDb();
  server = await startTestServer(db);
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
});
after(async () => {
  await browser?.close();
  await server?.close();
  db?.sqlite.close();
  restoreClock();
});

async function openForm({ width = 390, instant = "2026-11-20T12:00:00Z" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700, timezoneId: "Asia/Tokyo" });
  await context.route("https://**/*", (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date(instant) });
  await page.clock.setFixedTime(new Date(instant));
  await page.goto(`${server.url}/inscricao.html`);
  await page.selectOption("#baptismRequirement", "03 anos de batismo");
  await page.selectOption("#grade", "CFO");
  return { context, page, errors };
}

let cpfCounter = 10000000000;
async function fillRequired(page, { phone = true } = {}) {
  await page.fill("#fullName", "Candidata de Teste");
  await page.fill("#cpf", String(++cpfCounter));
  await page.fill("#birthDate", "01/01/1990");
  await page.selectOption("#maritalStatus", "Solteiro(a)");
  await page.selectOption("#hasChildren", "Nao");
  if (phone) {
    await page.fill("#whatsappDdd", "92");
    await page.fill("#whatsappPhone", "99999-9999");
  }
  await page.check("#declarationAccepted");
  await page.check("#lgpdAccepted");
}

async function submit(page) {
  const response = page.waitForResponse((response) => response.url().endsWith("/api/public-enrollments"));
  await page.click("#submitButton");
  const result = await response;
  assert.equal(result.status(), 201);
  await page.waitForSelector("#confirmationPanel.is-visible");
  return result.json();
}

test("navegador: limites exatos de Manaus mesmo com fuso do dispositivo em Tóquio", async () => {
  for (const [instant, open] of [
    ["2026-11-16T03:59:59.999Z", false],
    ["2026-11-16T04:00:00.000Z", true],
    ["2026-12-08T03:59:59.999Z", true],
    ["2026-12-08T04:00:00.000Z", false],
  ]) {
    const { context, page, errors } = await openForm({ instant });
    assert.equal(await page.isEnabled("#submitButton"), open, instant);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const { context, page } = await openForm({ instant: "2026-12-08T03:59:59.000Z" });
  assert.equal(await page.isEnabled("#submitButton"), true);
  await page.clock.setFixedTime(new Date("2026-12-08T04:00:00.000Z"));
  await page.clock.runFor(1001);
  assert.equal(await page.isEnabled("#submitButton"), false);
  await context.close();
});

test("checklist, ciência obrigatória, cadastro parcial, protocolo e mensagem exata no WhatsApp", async () => {
  const { context, page, errors } = await openForm();
  await fillRequired(page);
  assert.equal(await page.locator("[data-document]").count(), 6);
  for (const key of documentKeys) {
    await page.check(`[data-document="${key}"]`);
    assert.equal(await page.locator("[data-document]:checked").count(), 1);
    await page.uncheck(`[data-document="${key}"]`);
  }
  await page.check('[data-document="rg"]');
  await page.check('[data-document="cpf"]');
  if (process.env.CFO_SCREENSHOTS) {
    await mkdir(process.env.CFO_SCREENSHOTS, { recursive: true });
    await page.locator("#documentsChecklist").screenshot({ path: `${process.env.CFO_SCREENSHOTS}/cfo-checklist-mobile.png` });
  }
  let requests = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/public-enrollments")) requests++; });
  await page.click("#submitButton");
  assert.equal(await page.locator("#documentsAcknowledged").evaluate((element) => element.validity.valueMissing), true);
  assert.equal(requests, 0);
  await page.check("#documentsAcknowledged");
  const result = await submit(page);
  assert.equal(await page.textContent("#confirmationProtocol"), result.id);
  assert.deepEqual(await page.locator("#pendingDocuments li").allTextContents(), ["Certidão de estado civil", "Atestado de antecedentes criminais", "Carta de recomendação", "Comprovante de residência"]);
  const link = new URL(await page.getAttribute("#whatsappGuidance", "href"));
  assert.equal(link.origin, "https://wa.me");
  assert.equal(link.pathname, "/5592999999999");
  assert.equal(link.searchParams.get("text"), `A Paz do Senhor Jesus!

Sua pré-inscrição no CFO foi registrada com sucesso.

Protocolo: ${result.id}

Entrega dos documentos:
19/11 a 10/12/2026.
Atendimento às segundas e quintas-feiras.

Documentos necessários:
RG, CPF, certidão de estado civil, atestado de antecedentes criminais, carta de recomendação e comprovante de residência.

Documentos pendentes:
Certidão de estado civil, Atestado de antecedentes criminais, Carta de recomendação, Comprovante de residência

Atenção: a pré-inscrição não representa a efetivação da inscrição. A documentação deverá ser apresentada à secretaria da ETDA para conferência.

Deus abençoe!`);
  assert.match(link.href, /text=A%20Paz/);
  // Abort external navigation: verify the click target without sending messages.
  const destination = context.waitForEvent("request", (request) => request.url().startsWith("https://wa.me/"));
  await page.click("#whatsappGuidance");
  assert.equal((await destination).url(), link.href);
  assert.equal(requests, 1);
  assert.equal(await page.isDisabled("#submitButton"), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test("ALFA/INC continuam abertos após o prazo do CFO, sem checklist obrigatório", async () => {
  const { context, page, errors } = await openForm({ instant: "2026-12-08T04:00:00Z" });
  assert.equal(await page.isEnabled("#submitButton"), false);
  for (const course of ["ALFA", "INC"]) {
    await page.selectOption("#grade", course);
    assert.equal(await page.isEnabled("#submitButton"), true);
    assert.equal(await page.isVisible("#documentsChecklist"), false);
    assert.equal(await page.locator("#documentsAcknowledged").evaluate((input) => input.required), false);
  }
  await fillRequired(page);
  const response = page.waitForResponse("**/api/public-enrollments");
  await page.click("#submitButton");
  assert.equal((await response).status(), 201);
  await page.waitForSelector("#documentsPanel.is-visible");
  assert.equal(await page.isVisible("#confirmationPanel"), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test("nenhum documento marcado e WhatsApp ausente: salva e permite informar número após confirmar", async () => {
  const { context, page } = await openForm();
  await fillRequired(page, { phone: false });
  await page.check("#documentsAcknowledged");
  await submit(page);
  assert.equal(await page.locator("#pendingDocuments li").count(), 6);
  assert.equal(await page.isVisible("#confirmationWhatsapp"), true);
  assert.equal(await page.isVisible("#whatsappGuidance"), false);
  await page.fill("#confirmationWhatsapp", "123");
  assert.equal(await page.isVisible("#whatsappGuidance"), false);
  await page.fill("#confirmationWhatsapp", "+55 (92) 98888-7777");
  assert.equal(new URL(await page.getAttribute("#whatsappGuidance", "href")).pathname, "/5592988887777");
  await context.close();
});

test("cliques repetidos durante requisição lenta e depois do sucesso fazem um único cadastro", async () => {
  const { context, page } = await openForm();
  await fillRequired(page);
  await page.check("#documentsAcknowledged");
  const countBefore = savedRows(db).length;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let requests = 0;
  await page.route("**/api/public-enrollments", async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  const outgoing = page.waitForRequest("**/api/public-enrollments");
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) document.querySelector("#candidateForm").dispatchEvent(new Event("submit", { cancelable: true }));
  });
  await outgoing;
  assert.equal(await page.isDisabled("#submitButton"), true);
  release();
  await page.waitForSelector("#confirmationPanel.is-visible");
  await page.evaluate(() => document.querySelector("#candidateForm").dispatchEvent(new Event("submit", { cancelable: true })));
  assert.equal(requests, 1);
  assert.equal(savedRows(db).length, countBefore + 1);
  await context.close();
});

test("resposta perdida: nova tentativa recupera protocolo sem duplicidade", async () => {
  const { context, page } = await openForm();
  await fillRequired(page);
  await page.check("#documentsAcknowledged");
  const before = savedRows(db).length;
  let protocol;
  await page.route("**/api/public-enrollments", async (route) => {
    const response = await route.fetch();
    protocol = (await response.json()).protocol;
    await route.abort("failed");
  }, { times: 1 });
  await page.click("#submitButton");
  await page.waitForSelector("#formMessage.error.is-visible");
  assert.equal(await page.isEnabled("#submitButton"), true);
  const response = page.waitForResponse("**/api/public-enrollments");
  await page.click("#submitButton");
  assert.equal((await response).status(), 200);
  await page.waitForSelector("#confirmationPanel.is-visible");
  assert.equal(await page.textContent("#confirmationProtocol"), protocol);
  assert.equal(savedRows(db).length, before + 1);
  await context.close();
});

test("mobile 320/390/768 e desktop 1280: sem rolagem horizontal e com confirmação legível", async () => {
  for (const width of [320, 390, 768, 1280]) {
    const { context, page, errors } = await openForm({ width });
    await fillRequired(page);
    for (const input of await page.locator("[data-document]").all()) await input.check();
    await page.check("#documentsAcknowledged");
    await submit(page);
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.client, JSON.stringify({ width, ...dimensions }));
    assert.deepEqual(await page.locator("#pendingDocuments li").allTextContents(), ["Nenhum documento pendente."]);
    assert.ok(new URL(await page.getAttribute("#whatsappGuidance", "href")).searchParams.get("text").includes("Nenhum documento pendente."));
    assert.equal(await page.locator("#whatsappGuidance").evaluate((element) => element.getBoundingClientRect().height >= 44), true);
    assert.deepEqual(errors, []);
    if (process.env.CFO_SCREENSHOTS) {
      await mkdir(process.env.CFO_SCREENSHOTS, { recursive: true });
      await page.locator("#confirmationPanel").screenshot({ path: `${process.env.CFO_SCREENSHOTS}/cfo-confirmacao-${width}.png` });
    }
    await context.close();
  }
});

test("secretaria: foto ainda obrigatória para ativar e checklist permanece após efetivação", async () => {
  const record = JSON.parse(savedRows(db).find((row) => JSON.parse(row.payload).documentsChecklist)?.payload);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cookie = (await createSessionCookie({ role: "admin" }, envPasswords)).split(";")[0];
  await context.addCookies([{ name: "etda_session", value: cookie.slice("etda_session=".length), url: server.url }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${server.url}/secretaria.html`);
  await page.waitForSelector(".action-select");
  await page.selectOption(`.action-select[data-id="${record.id}"]`, "validate");
  await page.selectOption("#status", "Ativa");
  const dialog = page.waitForEvent("dialog");
  const blockedSubmission = page.locator("#enrollmentForm").evaluate((form) => form.dispatchEvent(new Event("submit", { cancelable: true })));
  const alert = await dialog;
  assert.match(alert.message(), /Capture a foto/);
  await alert.accept();
  await blockedSubmission;
  assert.equal(JSON.parse(savedRows(db).find((row) => row.id === record.id).payload).status, "Em espera");
  // Represent an existing stored photo; camera/R2 code and its permissions are unchanged.
  await page.locator("#candidatePhotoKey").evaluate((input) => { input.value = "test-existing-photo"; });
  const response = page.waitForResponse((response) => response.url().endsWith("/api/enrollments") && response.request().method() === "POST");
  await page.locator("#enrollmentForm").evaluate((form) => form.dispatchEvent(new Event("submit", { cancelable: true })));
  assert.equal((await response).status(), 201);
  const saved = JSON.parse(savedRows(db).find((row) => row.id === record.id).payload);
  assert.equal(saved.status, "Ativa");
  assert.equal(saved.id, record.id);
  for (const key of ["documentsChecklist", "documentsAcknowledged", "documentsAcknowledgedDate", "submissionKey"]) assert.deepEqual(saved[key], record[key]);
  assert.deepEqual(errors, []);
  await context.close();
});
