/* Consultation of the existing GET /api/gradebook collection, never version history. */
(() => {
  const lookup = document.querySelector('#gradebookLookup');
  const results = document.querySelector('#gradebookLookupResults');
  const message = document.querySelector('#gradebookLookupMessage');
  const detail = document.querySelector('#gradebookRecordDetail');
  const content = document.querySelector('#gradebookRecordContent');
  const filters = ['Student', 'Course', 'Year', 'Semester'].map(key => document.querySelector(`#gradebookFilter${key}`));
  let selectedId = '', limit = 20, opener = null;
  const more = document.createElement('button');
  more.type = 'button'; more.className = 'ghost-button'; more.textContent = 'Mostrar mais boletins';
  results.after(more);

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function options(select, entries) {
    const selected = select.value;
    select.replaceChildren(select.options[0]);
    for (const [value, label] of entries) select.add(new Option(label, value));
    select.value = [...select.options].some(option => option.value === selected) ? selected : '';
  }

  function showRecord(record, focus = false) {
    selectedId = record.id;
    detail.hidden = false;
    const description = node('p', 'Consulta do registro salvo. Alterações no formulário de edição não são incluídas nesta impressão.');
    const identity = node('dl', undefined, 'gradebook-record-identity');
    for (const [label, value] of [['Aluno', record.fullName], ['Curso', record.course], ['Período', record.period]]) {
      const field = node('div'); field.append(node('dt', label), node('dd', value || 'Não informado')); identity.append(field);
    }
    const table = node('table', undefined, 'gradebook-table');
    const head = node('thead'), row = node('tr');
    for (const title of ['Módulo', 'Nota final']) { const th = node('th', title); th.scope = 'col'; row.append(th); }
    head.append(row);
    const body = node('tbody');
    for (const module of record.modules || []) {
      const tr = node('tr');
      tr.append(node('td', formatGradebookModuleName(module.name)), node('td', formatScore(module.total ?? module.grade ?? 0)));
      body.append(tr);
    }
    table.append(head, body);
    const wrap = node('div', undefined, 'gradebook-table-wrap'); wrap.append(table);
    const summary = node('dl', undefined, 'gradebook-record-identity');
    for (const [label, value] of [['Total geral', formatScore(record.total)], ['Média final', formatScore(record.average)], ['Situação acadêmica', record.status || 'Não informada']]) {
      const field = node('div'); field.append(node('dt', label), node('dd', value)); summary.append(field);
    }
    const notes = node('p', record.notes || 'Sem observações.', 'gradebook-record-notes');
    content.replaceChildren(description, identity, wrap, summary, node('h4', 'Observações'), notes);
    if (focus) document.querySelector('#gradebookRecordTitle').focus();
  }

  function render() {
    const [student, course, year, semester] = filters.map(filter => filter.value);
    const records = gradebookRecords.filter(record => {
      const period = parseGradebookPeriod(record.period);
      return (!student || record.enrollmentId === student) && (!course || record.course === course) &&
        (!year || (year === 'unknown' ? !period.year : period.year === year)) && (!semester || period.semester === semester);
    });
    results.replaceChildren();
    for (const record of records.slice(0, limit)) {
      const item = node('li');
      const copy = node('div');
      copy.append(node('strong', record.fullName || 'Aluno não informado'),
        node('span', `${record.course || 'Curso não informado'} · ${record.period || 'Período não informado'}`),
        node('span', `Média ${formatScore(record.average)} · ${record.status || 'Situação não informada'}`));
      const open = node('button', 'Abrir boletim', 'ghost-button');
      open.type = 'button'; open.dataset.recordId = record.id;
      open.setAttribute('aria-label', `Abrir boletim de ${record.fullName || 'aluno'}, ${record.period || 'período não informado'}`);
      item.append(copy, open); results.append(item);
    }
    message.textContent = records.length ? `${records.length} boletim(ns) encontrado(s). Exibindo ${Math.min(limit, records.length)}.` :
      gradebookRecords.length ? 'Nenhum boletim corresponde aos filtros selecionados.' : 'Nenhum boletim salvo. Salve um boletim no formulário acima para consultá-lo aqui.';
    more.hidden = limit >= records.length;
    lookup.setAttribute('aria-busy', 'false');
  }

  function update() {
    options(filters[0], [...new Map(gradebookRecords.map(record => [record.enrollmentId, record.fullName || 'Aluno não informado']))].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR')));
    options(filters[1], [...new Set(gradebookRecords.map(record => record.course).filter(Boolean))].sort().map(course => [course, course]));
    const years = [...new Set(gradebookRecords.map(record => parseGradebookPeriod(record.period).year).filter(Boolean))].sort().reverse();
    options(filters[2], [...years.map(year => [year, year]), ...(gradebookRecords.some(record => !parseGradebookPeriod(record.period).year) ? [['unknown', 'Sem ano informado']] : [])]);
    if (selectedId) {
      const selected = gradebookRecords.find(record => record.id === selectedId);
      if (selected) showRecord(selected); else { detail.hidden = true; selectedId = ''; }
    }
    render();
  }

  filters.forEach(filter => filter.addEventListener('change', () => { limit = 20; detail.hidden = true; selectedId = ''; render(); }));
  more.addEventListener('click', () => { limit += 20; render(); });
  results.addEventListener('click', event => {
    const button = event.target.closest('button[data-record-id]');
    if (!button) return;
    const record = gradebookRecords.find(item => item.id === button.dataset.recordId);
    if (record) { opener = button; showRecord(record, true); }
  });
  document.querySelector('#closeSavedGradebook').addEventListener('click', () => { detail.hidden = true; selectedId = ''; if (opener?.isConnected) opener.focus(); });
  document.querySelector('#printSavedGradebook').addEventListener('click', () => {
    const record = gradebookRecords.find(item => item.id === selectedId);
    if (record) window.printSavedGradebook(record);
  });
  document.querySelector('#refreshGradebookRecords').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true; lookup.setAttribute('aria-busy', 'true');
    try { await loadRemoteGradebook({ preserveEditor: true }); }
    catch (error) { message.textContent = `${error.message} Tente atualizar a consulta novamente.`; }
    finally { button.disabled = false; lookup.setAttribute('aria-busy', 'false'); }
  });
  window.addEventListener('gradebook-records-updated', update);
  update();
})();
