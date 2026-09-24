const timeZone = "America/Manaus";
const isLocalPreview = location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
const apiBaseUrl = isLocalPreview
  ? "https://matriculasetdaam.pages.dev"
  : "";
const apiCredentials = apiBaseUrl ? "include" : "same-origin";

const authForm = document.querySelector("#authForm");
const appHeader = document.querySelector("#appHeader");
const loginInput = document.querySelector("#loginInput");
const adminPassword = document.querySelector("#adminPassword");
const authError = document.querySelector("#authError");
const logoutButton = document.querySelector("#logoutButton");
const gradesLink = document.querySelector("#gradesLink");
const adminNavLinks = document.querySelectorAll(".admin-nav");
const adminUsersLink = document.querySelector("#adminUsersLink");
const passwordLink = document.querySelector("#passwordLink");
const hero = document.querySelector("#hero");
const workspace = document.querySelector("#workspace");
const classDate = document.querySelector("#classDate");
const courseFilter = document.querySelector("#courseFilter");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const manualCode = document.querySelector("#manualCode");
const manualMatches = document.querySelector("#manualMatches");
const manualLookupStatus = document.querySelector("#manualLookupStatus");
const findButton = document.querySelector("#findButton");
const selectedPerson = document.querySelector("#selectedPerson");
const attendanceStatus = document.querySelector("#attendanceStatus");
const justificationLabel = document.querySelector("#justificationLabel");
const justification = document.querySelector("#justification");
const saveAttendanceButton = document.querySelector("#saveAttendanceButton");
const reportTable = document.querySelector("#reportTable");
const reportCards = document.querySelector("#reportCards");
const reportRecords = document.querySelector("#reportRecords");
const attendanceConfirmation = document.querySelector("#attendanceConfirmation");
const attendanceConfirmationText = document.querySelector("#attendanceConfirmationText");
const exportCsvButton = document.querySelector("#exportCsvButton");
const toast = document.querySelector("#toast");
const absenceAlert = document.querySelector("#absenceAlert");
const absenceAlertList = document.querySelector("#absenceAlertList");
const absenceAlertTotal = document.querySelector("#absenceAlertTotal");
const currentUserBadge = document.querySelector("#currentUserBadge");
const systemNav = document.querySelector("#systemNav");
const modulePanel = document.querySelector("#modulePanel");
const moduleFilter = document.querySelector("#moduleFilter");
const usersPanel = document.querySelector("#usersPanel");
const userForm = document.querySelector("#userForm");
const userName = document.querySelector("#userName");
const userLogin = document.querySelector("#userLogin");
const userPassword = document.querySelector("#userPassword");
const userCourse = document.querySelector("#userCourse");
const userModuleLabel = document.querySelector("#userModuleLabel");
const userModule = document.querySelector("#userModule");
const usersTable = document.querySelector("#usersTable");

const counters = {
  present: document.querySelector("#presentCount"),
  justified: document.querySelector("#justifiedCount"),
  absence: document.querySelector("#absenceCount"),
  records: document.querySelector("#recordCount"),
};


function apiHeaders(extra = {}) {
  return { accept: "application/json", ...extra };
}

async function loginSession(login, password) {
  const response = await fetch(`${apiBaseUrl}/api/session`, {
    method: "POST",
    credentials: apiCredentials,
    headers: apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ login, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Senha de acesso invalida.");
  return data;
}

async function logoutSession() {
  await fetch(`${apiBaseUrl}/api/session`, {
    method: "DELETE",
    credentials: apiCredentials,
    headers: apiHeaders(),
  }).catch(() => {});
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "ghost-button";
  dismiss.textContent = "Fechar mensagem";
  dismiss.addEventListener("click", () => { toast.hidden = true; });
  toast.append(document.createElement("br"), dismiss);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeStatus(value) {
  return normalize(value).trim();
}

function isAdminAccess(access = currentAccess) {
  const role = normalizeStatus(access?.role);
  return role === "admin" || role === "administrador";
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

function formatDateBr(value) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
}

function updateModuleVisibility() {
  const isCfo = courseFilter.value === "CFO";
  modulePanel.hidden = !isCfo;
  if (!isCfo) moduleFilter.value = "";
  if (isCfo && !isAdminAccess()) {
    const allowedModules = (currentAccess?.scopes || [{ course: currentAccess?.course, module: currentAccess?.module }])
      .filter((scope) => scope.course === "CFO" && scope.module).map((scope) => scope.module);
    const current = moduleFilter.value;
    moduleFilter.innerHTML = allowedModules.map((module) => `<option value="${escapeHtml(module)}">${escapeHtml(module)}</option>`).join("");
    moduleFilter.value = allowedModules.includes(current) ? current : (allowedModules[0] || "");
    moduleFilter.disabled = allowedModules.length <= 1;
  } else if (isCfo && isAdminAccess() && !moduleFilter.querySelector('option[value=""]')) {
    moduleFilter.innerHTML = '<option value="">Selecione</option><option>Teologia Basica</option><option>Etica Crista</option><option>Pratica Ministerial</option>';
  }
}

function renderAbsenceAlerts() {
  const alerts = absenceAlerts;
  absenceAlert.hidden = alerts.length === 0;
  absenceAlertTotal.textContent = `(${alerts.length} ${alerts.length === 1 ? "aluno" : "alunos"})`;
  if (!alerts.length) absenceAlert.open = false;
  absenceAlertList.innerHTML = alerts.map((item) => `<article class="absence-alert-item"><div><strong>${escapeHtml(item.name || "Aluno")}</strong><div class="small-note">${escapeHtml(item.course || "-")}${item.module ? ` · ${escapeHtml(item.module)}` : ""} · Verificar justificativa ou possível desistência</div></div><span class="absence-alert-count">${item.count} faltas</span></article>`).join("");
}

let currentAccess = null, absenceAlerts = [], callRows = [], callSnapshot = '';
let loadVersion = 0, ready = false, busy = false, page = 0;
const pageSize = 50;
const notice = document.querySelector('#recordsNotice');
const finalizeButton = document.querySelector('#finalizeCall');
const finalizeDialog = document.querySelector('#finalizeDialog');
const previousButton = document.querySelector('#previousRecords');
const nextButton = document.querySelector('#nextRecords');
const drafts = new Map();
function callContext() {
  return {date:classDate.value, course:courseFilter.value, module:moduleFilter.value};
}
async function requestJson(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials:apiCredentials, headers:apiHeaders(body ? {'content-type':'application/json'} : {}),
    ...(body ? {method:'POST',body:JSON.stringify(body)} : {})
  });
  const data = await response.json().catch(()=>({}));
  if (response.status===401) lockDashboard();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
function lockDashboard(message='') {
  ++loadVersion; ready=false; currentAccess=null; callRows=[]; drafts.clear();
  document.querySelector('#sessionLoading').hidden=true;
  authForm.style.display='grid'; appHeader.hidden=true;
  hero.classList.add('is-locked'); workspace.classList.add('is-locked');
  authError.textContent=message;
  authError.classList.add('is-visible');
  renderCall();
}
function unlockDashboard(access) {
  currentAccess=access;
  document.querySelector('#sessionLoading').hidden=true;
  authForm.style.display='none'; appHeader.hidden=false; systemNav.hidden=false; logoutButton.hidden=false;
  authError.classList.remove('is-visible');
  hero.classList.remove('is-locked'); workspace.classList.remove('is-locked');
  currentUserBadge.hidden=false; currentUserBadge.textContent=access.name || 'Administrador';
  adminNavLinks.forEach(link=>{link.hidden=!isAdminAccess();});
  adminUsersLink.hidden=!isAdminAccess(); gradesLink.hidden=false; passwordLink.hidden=isAdminAccess();
}
function filteredRows() {
  const query=normalize(searchInput.value).trim();
  return callRows.filter(row=>normalize(`${row.fullName} ${row.cpf}`).includes(query));
}
function statusControls(row) {
  const draft=drafts.get(row.id) || {status:row.record?.status || '',justification:row.record?.justification || ''};
  const id=escapeHtml(row.id), name=escapeHtml(row.fullName);
  return `<div class="call-status" data-student="${id}"><select aria-label="Presença de ${name}" ${busy?'disabled':''}><option value="">Pendente</option>${['Presente','Justificado','Falta'].map(status=>`<option ${draft.status===status?'selected':''}>${status}</option>`).join('')}</select><textarea aria-label="Justificativa de ${name}" maxlength="2000" placeholder="Justificativa" ${draft.status==='Justificado'?'':'hidden'} ${busy?'disabled':''}>${escapeHtml(draft.justification)}</textarea></div>`;
}
function renderCall() {
  const totals={present:0,justified:0,absence:0,records:0};
  callRows.forEach(row=>{totals[({Presente:'present',Justificado:'justified',Falta:'absence'})[row.record?.status] || 'records']++;});
  Object.entries(counters).forEach(([key,element])=>{element.textContent=totals[key];});
  const filtered=filteredRows(); page=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);
  const save=row=>`<button class="primary-button call-save" type="button" data-save="${escapeHtml(row.id)}" ${busy||!ready?'disabled':''}>Salvar</button>`;
  const time=row=>row.record?.updatedAt ? new Date(row.record.updatedAt).toLocaleString('pt-BR',{timeZone}) : '—';
  reportTable.innerHTML=visible.map(row=>`<tr><td class="call-name">${escapeHtml(row.fullName)}</td>${[row.cpf,row.region,row.role,row.pastor,row.city].map(value=>`<td>${escapeHtml(value || '—')}</td>`).join('')}<td>${statusControls(row)}</td><td class="call-time">${escapeHtml(time(row))}</td><td>${save(row)}</td></tr>`).join('');
  reportCards.innerHTML=visible.map(row=>`<article class="attendance-card" role="listitem"><h3>${escapeHtml(row.fullName)}</h3><p>${escapeHtml(row.cpf)} · ${escapeHtml(row.city)}</p><p>Região: ${escapeHtml(row.region || '—')} · Cargo: ${escapeHtml(row.role || '—')} · Pastor: ${escapeHtml(row.pastor || '—')}</p>${statusControls(row)}<p class="call-time">${escapeHtml(time(row))}</p>${save(row)}</article>`).join('');
  document.querySelector('#recordsPage').textContent=filtered.length ? `${page+1} / ${Math.ceil(filtered.length/pageSize)} · ${filtered.length} alunos` : 'Nenhum aluno';
  previousButton.disabled=busy||page===0; nextButton.disabled=busy||(page+1)*pageSize>=filtered.length;
  finalizeButton.disabled=busy||!ready||!totals.records||drafts.size>0;
  exportCsvButton.disabled=busy||!ready;
  document.querySelector('#callSummary').textContent=`${callRows.length} alunos · ${totals.records} pendentes${drafts.size?' · Salve as alterações antes de finalizar.':''}`;
  [classDate,courseFilter,moduleFilter,refreshButton].forEach(element=>{element.disabled=busy;});
}
async function loadCall() {
  const version=++loadVersion, context=callContext(); ready=false; callRows=[]; callSnapshot=''; drafts.clear(); page=0;
  if(context.course!=='CFO') context.module='';
  absenceAlerts=[]; renderAbsenceAlerts(); renderCall();
  notice.hidden=false;
  document.querySelector('#callContext').textContent=[formatDateBr(context.date),context.course,context.course==='CFO'?context.module:''].filter(Boolean).join(' · ');
  if (!context.date || !context.course || (context.course==='CFO'&&!context.module)) {
    notice.textContent='Selecione a data, o curso e, para CFO, o módulo.'; return;
  }
  notice.textContent='Carregando todos os alunos da turma...';
  try {
    let cursor=null, snapshot='', rows=[];
    do {
      const params=new URLSearchParams(context);
      if (cursor) {params.set('cursor',cursor);params.set('snapshot',snapshot);}
      const data=await requestJson(`/api/roll-call?${params}`);
      if(version!==loadVersion) return;
      rows.push(...data.rows); snapshot=data.snapshot; cursor=data.nextCursor;
    } while(cursor);
    callRows=rows; callSnapshot=snapshot; ready=true; notice.hidden=rows.length>0;
    notice.textContent='Nenhum aluno ativo neste curso.'; renderCall();
    const risk=await requestJson(`/api/attendance?${new URLSearchParams({view:'risk',course:context.course,module:context.module})}`);
    if(version===loadVersion) {absenceAlerts=risk.alerts||[];renderAbsenceAlerts();}
  } catch(error) {
    if(version!==loadVersion) return;
    ready=false; notice.hidden=false; notice.textContent=error.message; renderCall();
  }
}
async function initializeAccess(access) {
  unlockDashboard(access);
  const data=await requestJson('/api/roll-call?view=courses');
  courseFilter.innerHTML='<option value="">Selecione o curso</option>'+data.courses.map(course=>`<option>${escapeHtml(course)}</option>`).join('');
  if(data.courses.length===1) courseFilter.value=data.courses[0];
  updateModuleVisibility(); await loadCall();
}
reportRecords.addEventListener('input',event=>{
  const container=event.target.closest('[data-student]'); if(!container) return;
  drafts.set(container.dataset.student,{status:container.querySelector('select').value,justification:container.querySelector('textarea').value});
  if(event.target.tagName==='SELECT') renderCall();
  else finalizeButton.disabled=true;
});
reportRecords.addEventListener('click',async event=>{
  const button=event.target.closest('[data-save]'); if(!button||busy||!ready) return;
  const row=callRows.find(row=>row.id===button.dataset.save);
  const draft=drafts.get(row.id)||{status:row.record?.status,justification:row.record?.justification};
  if(!draft.status) return showToast('Selecione Presente, Justificado ou Falta.');
  busy=true; renderCall();
  try {
    const data=await requestJson('/api/roll-call',{...callContext(),action:'save',enrollmentId:row.id,...draft});
    row.record=data.record; drafts.delete(row.id);
    // Reload the snapshot only after all unsaved edits have been saved.
    if(!drafts.size) await loadCall();
    showToast('Presença salva.');
  } catch(error) {showToast(error.message);}
  finally {busy=false;renderCall();}
});
finalizeButton.addEventListener('click',()=>{
  if(!ready||busy||drafts.size) return;
  const pending=callRows.filter(row=>!row.record).length;
  document.querySelector('#finalizeDescription').textContent=`${formatDateBr(classDate.value)} · ${courseFilter.value} ${moduleFilter.value}. Os ${pending} alunos pendentes receberão Falta. Os registros já salvos serão preservados.`;
  finalizeDialog.showModal();
});
document.querySelector('#cancelFinalize').addEventListener('click',()=>finalizeDialog.close());
document.querySelector('#confirmFinalize').addEventListener('click',async()=>{
  if(busy||!ready||drafts.size) return;
  busy=true; finalizeDialog.close(); renderCall();
  try {
    await requestJson('/api/roll-call',{...callContext(),action:'finalize',confirmed:true,expectedPending:callRows.filter(row=>!row.record).length,snapshot:callSnapshot});
    showToast('Chamada finalizada.');
  } catch(error) {showToast(error.message);}
  finally {await loadCall();busy=false;renderCall();}
});
function csvCell(value) {
  let text=String(value??'');
  if(/^[=+@\-\t\r]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function exportCsv() {
  if(!ready||busy) return;
  const rows=[['Nome','CPF','Curso','Módulo','Data','Presença','Justificativa'],...callRows.map(row=>[row.fullName,row.cpf,courseFilter.value,moduleFilter.value,classDate.value,row.record?.status||'Pendente',row.record?.justification||''])];
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`chamada-${classDate.value}.csv`;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
exportCsvButton.addEventListener('click',exportCsv);
previousButton.addEventListener('click',()=>{page--;renderCall();});
nextButton.addEventListener('click',()=>{page++;renderCall();});
searchInput.addEventListener('input',()=>{page=0;renderCall();});
refreshButton.addEventListener('click',loadCall);
classDate.addEventListener('change',loadCall);
courseFilter.addEventListener('change',()=>{updateModuleVisibility();loadCall();});
moduleFilter.addEventListener('change',loadCall);
authForm.addEventListener('submit',async event=>{
  event.preventDefault();const button=authForm.querySelector('button');button.disabled=true;authError.textContent='';
  try {await initializeAccess(await loginSession(loginInput.value,adminPassword.value));adminPassword.value='';}
  catch(error) {lockDashboard(error.message);}
  finally {button.disabled=false;}
});
logoutButton.addEventListener('click',async()=>{
  if(busy) return;
  try {const response=await fetch(`${apiBaseUrl}/api/session`,{method:'DELETE',credentials:apiCredentials});if(!response.ok) throw new Error('Não foi possível sair. Tente novamente.');lockDashboard('Sessão encerrada.');}
  catch(error) {showToast(error.message);}
});
classDate.value=getTodayDate();
requestJson('/api/session').then(initializeAccess).catch(error=>lockDashboard(error.message));
