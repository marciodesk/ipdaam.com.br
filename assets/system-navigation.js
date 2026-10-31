(() => {
  const sidebar = document.querySelector('.system-sidebar');
  if (!sidebar) return;
  // Administrative declaration issuance uses the existing session and permissions.
  let declarationsLoading = false;
  function addDeclarationsLink() {
    if (declarationsLoading || sidebar.querySelector('a[href="declaracoes.html"]')) return;
    declarationsLoading = true;
    fetch('/api/session', { credentials:'same-origin', headers:{accept:'application/json'} })
      .then(response => response.ok ? response.json() : null)
      .then(access => {
        const role = String(access?.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!['admin', 'administrador'].includes(role)) return;
        const link = document.createElement('a');
        link.href = 'declaracoes.html'; link.textContent = 'Declarações';
        link.className = 'nav-link';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class','menu-icon'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
        svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.6'); svg.setAttribute('aria-hidden','true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d','M5 3h10l4 4v14H5zM8 11h8M8 15h8M8 18h5'); svg.append(path); link.prepend(svg);
        sidebar.querySelector('.system-nav')?.append(link);
      }).catch(() => {}).finally(() => { declarationsLoading = false; });
  }
  if (!sidebar.hidden) addDeclarationsLink();
  if (!sidebar.id) sidebar.id = 'systemSidebar';
  let footer = sidebar.querySelector('.sidebar-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    sidebar.append(footer);
  }
  let logout = sidebar.querySelector('.logout-button, .logout');
  if (!logout) {
    logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'logout-button';
    logout.textContent = 'Sair';
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        const response = await fetch('/api/session', { method:'DELETE', credentials:'same-origin' });
        if (!response.ok) throw new Error();
        location.href = 'presenca.html';
      } catch {
        logout.disabled = false;
        logout.textContent = 'Tentar sair novamente';
      }
    });
  }
  footer.append(logout);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'system-menu-toggle';
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>';
  document.body.prepend(toggle);
  const close = () => {
    document.body.classList.remove('system-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('system-menu-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('system-menu-open')) {
      close();
      toggle.focus();
    }
  });
  new MutationObserver(() => {
    if (sidebar.hidden) close(); else addDeclarationsLink();
  }).observe(sidebar, { attributes:true, attributeFilter:['hidden'] });
  const paths = {
    'declaracoes.html':'M5 3h10l4 4v14H5zM8 11h8M8 15h8M8 18h5',
    'secretaria.html?modulo=boletim':'M5 3h12l2 2v16H5zM8 8h8M8 12h8M8 16h5',
    'inscricao.html':'M12 3H4v18h16V11M8 8h4M8 12h3M8 16h8M18 2v6M15 5h6',
    'cursos.html':'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    'secretaria.html':'M4 21V5h16v16M8 5V3h8v2M8 9h2m4 0h2M8 13h2m4 0h2M10 21v-4h4v4',
    'presenca.html':'M9 5H5v16h14V5h-4M9 3h6v4H9zM8 14l3 3 5-6',
    'notas.html':'M4 3h16v18H4zM8 8h8M8 12h8M8 16h5',
    'usuarios-presenca.html':'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4',
    'trocar-senha-presenca.html':'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3'
  };
  sidebar.querySelectorAll('.system-nav a').forEach(link => {
    if (link.matches('.active, .is-active')) link.setAttribute('aria-current', 'page');
    if (link.querySelector('.menu-icon')) return;
    const path = paths[link.getAttribute('href')];
    if (!path) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'menu-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    link.prepend(svg);
  });
})();
