import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createDb, setTestNow, startTestServer, restoreClock } from "./helpers.mjs";

const port = Number(process.env.CFO_PREVIEW_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CFO_PREVIEW_PORT deve ser uma porta válida.");
const scenarios = {
  before: ["2026-11-15T12:00:00Z", "Antes da abertura — 15/11/2026"],
  open: ["2026-11-20T12:00:00Z", "Inscrições abertas — 20/11/2026"],
  closed: ["2026-12-08T04:00:00Z", "Após o encerramento — 08/12/2026"],
};
let scenario = "open";
setTestNow(scenarios[scenario][0]);
const db = await createDb();
const upstream = await startTestServer(db);
const policy = JSON.parse(await readFile(new URL("../scripts/pages-files.json", import.meta.url), "utf8"));
const publicPaths = new Set(policy.public.map((name) => `/${name}`));

function previewMarkup() {
  const instant = JSON.stringify(scenarios[scenario][0]);
  const clock = `<script>const PreviewRealDate=Date;globalThis.Date=class extends PreviewRealDate{constructor(...args){super(...(args.length?args:[${instant}]))}static now(){return new PreviewRealDate(${instant}).getTime()}};</script>`;
  const banner = `<aside style="padding:16px;background:#fff5ce;border-bottom:2px solid #ba8600;color:#332600;font:16px Arial;line-height:1.5"><strong>PRÉVIA LOCAL DE TESTE — CFO</strong><br>Use dados fictícios. O banco está apenas na memória deste processo.<br><label style="display:block;margin-top:8px;color:inherit">Data simulada: <select id="previewScenario" style="width:auto;max-width:100%">${Object.entries(scenarios).map(([key, [, label]]) => `<option value="${key}" ${key === scenario ? "selected" : ""}>${label}</option>`).join("")}</select></label><button id="previewReset" type="button" style="margin-top:8px;padding:8px">Limpar cadastros fictícios</button><br><small>Esta prévia exercita a pré-inscrição. Não acessa Cloudflare, D1 ou R2 de produção. O WhatsApp só abre quando você clicar no botão.</small></aside><script>document.getElementById('previewScenario').addEventListener('change',async function(){await fetch('/__preview/scenario',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenario:this.value})});location.reload()});document.getElementById('previewReset').addEventListener('click',async()=>{await fetch('/__preview/reset',{method:'POST'});location.reload()});</script>`;
  return { clock, banner };
}

const preview = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/") url.pathname = "/inscricao.html";
    if (!publicPaths.has(url.pathname) && publicPaths.has(`${url.pathname}.html`)) url.pathname += ".html";
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (url.pathname.startsWith("/__preview/")) {
      if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
      if (url.pathname === "/__preview/scenario") {
        const selected = JSON.parse(body.toString()).scenario;
        if (!Object.hasOwn(scenarios, selected)) throw new Error("Cenário inválido.");
        scenario = selected;
        setTestNow(scenarios[scenario][0]);
      } else if (url.pathname === "/__preview/reset") {
        db.sqlite.exec("DELETE FROM enrollments");
      } else { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end('{"ok":true}');
      return;
    }
    // Serve only reviewed public files and the two APIs used by the public page.
    if (!publicPaths.has(url.pathname) && !["/api/public-enrollments", "/api/session"].includes(url.pathname)) {
      res.writeHead(404); res.end("Página não disponível nesta prévia."); return;
    }
    const response = await fetch(`${upstream.url}${url.pathname}${url.search}`, {
      method: req.method, headers: req.headers,
      ...(body.length ? { body, duplex: "half" } : {}),
    });
    const headers = Object.fromEntries(response.headers);
    delete headers["content-length"];
    headers["cache-control"] = "no-store";
    let result = Buffer.from(await response.arrayBuffer());
    if ((headers["content-type"] || "").includes("text/html")) {
      const { clock, banner } = previewMarkup();
      result = Buffer.from(result.toString().replace("<head>", `<head>${clock}`).replace("<body>", `<body>${banner}`));
    }
    res.writeHead(response.status, headers);
    res.end(result);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Erro na prévia local: ${error.message}`);
  }
});

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => preview.close(resolve));
  await upstream.close();
  db.sqlite.close();
  restoreClock();
  process.exitCode = exitCode;
}
preview.on("error", async (error) => {
  console.error(error.code === "EADDRINUSE" ? `A porta ${port} está ocupada. Defina CFO_PREVIEW_PORT com outra porta.` : error.message);
  await stop(1);
});
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
preview.listen(port, "127.0.0.1", () => {
  console.log(`Prévia local: http://127.0.0.1:${port}/inscricao.html`);
  console.log("Use dados fictícios. Escolha a data simulada no topo. Ctrl+C encerra e descarta os cadastros de teste.");
});
