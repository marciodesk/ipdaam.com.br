/* Read-only print presentation. Editing and academic calculations stay in secretaria.html. */
(() => {
  let savedRecord = null;
  const documentView = document.createElement('section');
  documentView.className = 'gradebook-print-document';
  documentView.setAttribute('aria-label', 'Boletim Acadêmico Ministerial para impressão');
  document.body.append(documentView);

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function field(label, value) {
    const group = node('div');
    group.append(node('dt', label), node('dd', value || 'Não informado'));
    return group;
  }

  // Load once before the print dialog opens so the institutional mark is ready.
  const logo = node('img');
  logo.src = '/assets/logo/etda.png';
  logo.alt = 'ETDA';

  window.addEventListener('beforeprint', () => {
    if (gradebookPanel.classList.contains('is-locked') ||
        gradebookPanel.classList.contains('is-hidden')) return;

    const student = enrollments.find(item => item.id === gradebookStudent.value);
    const data = savedRecord || {
      fullName: student?.fullName,
      course: student?.grade,
      period: gradebookPeriod.value ? getGradebookPeriodValue() : 'Não informado',
      modules: [...gradebookBody.querySelectorAll('tr')].map(row => ({
        name: row.dataset.module || '', total: row.querySelector('[data-kind="grade"]')?.value,
      })),
      total: gradebookTotal.textContent, average: gradebookAverage.textContent,
      status: gradebookStatus.textContent, notes: gradebookNotes.value,
    };
    const header = node('header', undefined, 'boletim-document-header');
    const institution = node('div');
    institution.append(node('strong', 'Escola Teológica Deus é Amor'), node('p', 'ETDA Manaus'));
    header.append(logo, institution);

    const identification = node('dl', undefined, 'boletim-document-identification');
    identification.append(field('Aluno', data.fullName), field('Curso', data.course),
      field('Semestre', data.period), field('Data de emissão', new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Manaus',
      }).format(new Date()) + ' (Manaus)'));

    const table = node('table', undefined, 'boletim-document-table');
    const head = node('thead');
    const labels = node('tr');
    for (const label of ['Módulo', 'Nota final']) {
      const cell = node('th', label);
      cell.scope = 'col';
      labels.append(cell);
    }
    head.append(labels);
    const body = node('tbody');
    for (const module of data.modules || []) {
      const line = node('tr');
      const value = module.total ?? module.grade;
      line.append(node('td', formatGradebookModuleName(module.name || '')),
        node('td', value !== '' && value != null ? formatScore(toScore(value)) : '—'));
      body.append(line);
    }
    table.append(head, body);

    const summary = node('dl', undefined, 'boletim-document-summary');
    summary.append(field('Total geral', savedRecord ? formatScore(data.total) : data.total),
      field('Média final', savedRecord ? formatScore(data.average) : data.average),
      field('Situação acadêmica', data.status));
    const notes = node('section', undefined, 'boletim-document-notes');
    notes.append(node('h2', 'Observações'), node('p', data.notes || 'Sem observações.'));
    const signatures = node('footer', undefined, 'boletim-document-signatures');
    signatures.append(node('div', 'Secretaria'), node('div', 'Responsável Acadêmico'));

    documentView.replaceChildren(header, node('h1', 'Boletim Acadêmico Ministerial'),
      identification, table, summary, notes, signatures);
    document.body.classList.add('printing-gradebook');
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-gradebook');
    documentView.replaceChildren();
    savedRecord = null;
  });

  window.printSavedGradebook = record => {
    savedRecord = record;
    try { window.print(); }
    catch (error) {
      savedRecord = null;
      document.body.classList.remove('printing-gradebook');
      documentView.replaceChildren();
      throw error;
    }
  };
})();
