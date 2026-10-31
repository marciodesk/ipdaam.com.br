(() => {
  const $ = selector => document.querySelector(selector);
  const form = $('#declarationsForm'), preview = $('#declarationsPreview');
  const studentInput = $('#declarationsStudent'), courseInput = $('#declarationsCourse');
  const typeInput = $('#declarationsType'), responsible = $('#declarationsResponsible');
  let students = [], eligibility = null, currentRecord = null, records = [], requestId = null;
  let historyCursor = null;
  let eligibilityVersion = 0, busy = false, storageReady = false;
  const printLogo = new Image(); printLogo.src = '/assets/logo/etda.png'; printLogo.alt = 'ETDA';
  const date = value => new Intl.DateTimeFormat('pt-BR', { dateStyle:'long', timeStyle:'short', timeZone:'America/Manaus' }).format(new Date(value));
  const period = () => $('#declarationsSemester').value ? `${$('#declarationsYear').value} - ${$('#declarationsSemester').value}º semestre` : '';
  const student = () => students.find(item => item.id === studentInput.value);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function lock(message = '') {
    students = []; records = []; eligibility = null; currentRecord = null; storageReady = false;
    historyCursor = null;
    ++eligibilityVersion;
    preview.replaceChildren(); $('#declarationsHistory').replaceChildren();
    $('#declarationsPrintDocument').replaceChildren();
    $('#declarationsWorkspace').hidden = true; $('.system-sidebar').hidden = true;
    $('#declarationsLogin').hidden = false; $('#declarationsSession').hidden = true;
    $('#declarationsLoginError').textContent = message;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials:'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) lock(data.error || 'Acesso restrito à Secretaria.');
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
    return data;
  }

  function documentNode(record, draft = false, printing = false) {
    const article = node('article', undefined, 'declaration-document');
    const header = node('header', undefined, 'declaration-letterhead');
    const logo = printing ? printLogo : node('img');
    if (!printing) { logo.src = '/assets/logo/etda.png'; logo.alt = 'ETDA'; }
    const institution = node('div');
    institution.append(node('strong', 'Escola Teológica Deus é Amor'), node('p', 'ETDA Manaus'));
    header.append(logo, institution); article.append(header);
    if (draft) article.append(node('p', 'PRÉ-VISUALIZAÇÃO — NÃO EMITIDA', 'declaration-draft'));
    article.append(node('h2', record.type === 'completion' ? 'Declaração de Conclusão de Curso' : 'Declaração de Estudos'));
    if (!printing) article.append(node('p', `Controle: ${record.controlNumber || 'gerado somente após a emissão'}`, 'declaration-control'));
    article.append(node('p', record.statement, 'declaration-statement'));
    article.append(node('p', `Período de referência: ${record.period || 'não informado'}.`));
    const emissionDate = printing
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle:'long', timeZone:'America/Manaus' }).format(new Date())
      : `${date(record.issuedAt)} (horário de Manaus)`;
    article.append(node('p', `Manaus, ${emissionDate}.`, 'declaration-emission'));
    const signature = node('div', undefined, 'declaration-signature');
    signature.append(node('strong', record.issuerName || 'Responsável autorizado'), node('div', 'Responsável autorizado — ETDA Manaus'));
    article.append(signature, node('p', 'Esta declaração não substitui o certificado de conclusão de curso.', 'declaration-disclaimer'));
    return article;
  }

  function update() {
    const selected = student();
    const eligible = selected && eligibility?.enrollmentId === selected.id && eligibility[typeInput.value] === true;
    const year = Number($('#declarationsYear').value);
    $('#declarationsIssue').disabled = busy || !storageReady || !eligible || responsible.value.trim().length < 6 ||
      !$('#declarationsAuthorized').checked || !period() || !Number.isInteger(year) || year < 1900 || year > 9999;
    $('#declarationsPrint').disabled = !currentRecord;
    const status = $('#declarationsEligibility');
    status.dataset.eligible = String(Boolean(eligible));
    status.textContent = !selected ? 'Selecione uma matrícula para verificar a elegibilidade.' :
      !eligibility ? 'Aguardando verificação da matrícula. A emissão permanece bloqueada.' :
      eligible ? typeInput.value === 'studies' ? 'Matrícula ativa: declaração de estudos disponível após confirmar o responsável autorizado.' : 'Conclusão integral homologada e certificado pendente: emissão disponível após confirmar o responsável autorizado.' :
      typeInput.value === 'studies' ? 'Emissão bloqueada: somente matrícula ativa com identificação completa pode receber declaração de estudos.' : `Emissão bloqueada. ${eligibility.reasons.join(' ')}`;
    if (currentRecord) {
      preview.replaceChildren(documentNode(currentRecord));
      $('#declarationsPreviewState').textContent = `Documento emitido em ${date(currentRecord.issuedAt)}. Reimpressão mantém os dados originais.`;
      return;
    }
    $('#declarationsPreviewState').textContent = 'A pré-visualização não é um documento emitido.';
    if (!selected) { preview.replaceChildren(node('p', 'Selecione um aluno para visualizar o modelo.')); return; }
    const statement = typeInput.value === 'studies'
      ? eligible ? `Declaramos, para os devidos fins, que ${selected.fullName} encontra-se regularmente matriculado(a) e regularmente cursando o curso ${selected.grade}, na Escola Teológica Deus é Amor — ETDA Manaus, no período ${period()}.` : 'Declaração indisponível: a matrícula precisa estar ativa e com identificação completa.'
      : 'Modelo de conclusão integral: a afirmação de curso concluído e certificado pendente somente será emitida após homologação documental da Secretaria e comprovação de todos os requisitos institucionais.';
    preview.replaceChildren(documentNode({ type:typeInput.value, statement, period:period(), issuedAt:new Date().toISOString(), issuerName:responsible.value.trim() }, true));
  }

  function invalidate() { currentRecord = null; requestId = null; $('#declarationsIssueMessage').textContent = ''; }

  async function verify() {
    const version = ++eligibilityVersion, selected = student();
    eligibility = null; invalidate(); update();
    if (!selected) return;
    try {
      const data = await api(`/api/declarations/eligibility?enrollmentId=${encodeURIComponent(selected.id)}`);
      if (version !== eligibilityVersion) return;
      eligibility = data; update();
    } catch (error) {
      if (version !== eligibilityVersion) return;
      update(); $('#declarationsEligibility').textContent = error.message + ' A emissão permanece bloqueada.';
    }
  }

  function filterStudents() {
    const selected = studentInput.value, search = normalize($('#declarationsSearch').value);
    const filtered = students.filter(item => (!courseInput.value || item.grade === courseInput.value) && normalize(item.fullName).includes(search));
    studentInput.replaceChildren(new Option(filtered.length ? 'Selecione um aluno' : 'Nenhum aluno encontrado', ''));
    for (const item of filtered) studentInput.add(new Option(`${item.fullName} — ${item.grade || 'Sem curso'} · ${item.status}`, item.id));
    studentInput.value = filtered.some(item => item.id === selected) ? selected : '';
    verify();
  }

  async function loadHistory(append = false) {
    const data = await api('/api/declarations' + (append && historyCursor ? `?cursor=${encodeURIComponent(historyCursor)}` : ''));
    records = append ? [...records,...data.records] : data.records;
    historyCursor = data.nextCursor; storageReady = true;
    $('#declarationsHistoryMore').hidden = !historyCursor;
    $('#declarationsHistoryMessage').textContent = records.length ? `Exibindo ${records.length} de ${data.total} emissão(ões).` : 'Nenhuma declaração emitida.';
    const list = $('#declarationsHistory'); list.replaceChildren();
    for (const record of records) {
      const item = node('li'), copy = node('div');
      copy.append(node('strong', record.studentName), node('span', `${record.type === 'studies' ? 'Estudos' : 'Conclusão de curso'} · ${record.course} · ${record.period}`),
        node('span', `${date(record.issuedAt)} · Emissor: ${record.issuerName} · Conta: ${record.issuerAccount}`), node('span', record.controlNumber));
      const open = node('button', 'Abrir / Reimprimir'); open.type = 'button';
      open.addEventListener('click', () => { currentRecord = record; update(); $('#declarationsPrint').focus(); });
      item.append(copy, open); list.append(item);
    }
    update();
  }

  async function initialize(access) {
    if (!['admin','administrador'].includes(normalize(access.role))) { lock('Este módulo é restrito à Secretaria.'); return; }
    const data = await api('/api/enrollments');
    students = data.enrollments.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName), 'pt-BR'));
    courseInput.replaceChildren(new Option('Todos os cursos', ''));
    for (const course of [...new Set(students.map(item => item.grade).filter(Boolean))].sort()) courseInput.add(new Option(course, course));
    responsible.value = access.name || '';
    $('#declarationsYear').value = new Intl.DateTimeFormat('en', { year:'numeric', timeZone:'America/Manaus' }).format(new Date());
    $('#declarationsLogin').hidden = true; $('#declarationsWorkspace').hidden = false; $('.system-sidebar').hidden = false;
    $('#declarationsSession').hidden = true;
    filterStudents();
    try { await loadHistory(); }
    catch (error) { storageReady = false; $('#declarationsHistoryMessage').textContent = `${error.message} Verifique a migração local de declarações.`; update(); }
  }

  $('#declarationsLogin').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try { const access = await api('/api/session', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ login:'admin', password:$('#declarationsPassword').value }) }); $('#declarationsPassword').value = ''; await initialize(access); }
    catch (error) { lock(error.message); } finally { button.disabled = false; }
  });
  $('#declarationsSearch').addEventListener('input', filterStudents);
  courseInput.addEventListener('change', filterStudents); studentInput.addEventListener('change', verify);
  for (const input of [typeInput, $('#declarationsYear'), $('#declarationsSemester'), responsible, $('#declarationsAuthorized')]) input.addEventListener('input', () => { invalidate(); update(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if ($('#declarationsIssue').disabled) return;
    busy = true; requestId ||= crypto.randomUUID(); update();
    try {
      const data = await api('/api/declarations', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
        enrollmentId:studentInput.value, course:student().grade, type:typeInput.value, period:period(), responsibleName:responsible.value.trim(), authorized:$('#declarationsAuthorized').checked, requestId,
      }) });
      currentRecord = data.record;
      $('#declarationsIssueMessage').textContent = 'Declaração registrada. Use Imprimir / Salvar PDF para obter o documento.';
      // Require a deliberate new request before creating another emission.
      $('#declarationsAuthorized').checked = false;
      try { await loadHistory(); } catch { $('#declarationsHistoryMessage').textContent = 'Documento emitido. Não foi possível atualizar a lista; tente atualizar o histórico.'; }
    } catch (error) { $('#declarationsIssueMessage').textContent = error.message; eligibility = null; }
    finally { busy = false; update(); }
  });
  $('#declarationsRefresh').addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { await loadHistory(); } catch (error) { $('#declarationsHistoryMessage').textContent = error.message; } finally { button.disabled = false; } });
  $('#declarationsHistoryMore').addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { await loadHistory(true); } catch (error) { $('#declarationsHistoryMessage').textContent = error.message; } finally { button.disabled = false; } });
  $('#declarationsPrint').addEventListener('click', () => { if (currentRecord) window.print(); });
  window.addEventListener('beforeprint', () => {
    $('#declarationsPrintDocument').replaceChildren(currentRecord ? documentNode(currentRecord, false, true) : node('p', 'Nenhuma declaração emitida selecionada. Emita um documento autorizado ou abra um registro do histórico.'));
  });
  window.addEventListener('afterprint', () => $('#declarationsPrintDocument').replaceChildren());
  api('/api/session').then(initialize).catch(error => lock(error.message));
})();
