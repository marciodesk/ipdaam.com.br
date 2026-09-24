(() => {
  const sidebar = document.querySelector('#enrollmentSidebar');
  const logout = document.querySelector('#enrollmentLogout');
  fetch('/api/session', { credentials: 'same-origin', headers: { accept: 'application/json' } })
    .then(async response => {
      if (!response.ok) return;
      const access = await response.json();
      if (!access.role) return;
      const admin = ['admin', 'administrador'].includes(String(access.role).toLowerCase());
      sidebar.querySelectorAll('[data-admin-menu]').forEach(link => { link.hidden = !admin; });
      sidebar.querySelectorAll('[data-teacher-menu]').forEach(link => { link.hidden = admin; });
      sidebar.hidden = false;
      const back = document.querySelector('.back-link');
      if (back) back.hidden = true;
    })
    .catch(() => { /* Public enrollment stays available without a session. */ });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      const response = await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error();
      location.href = 'presenca.html';
    } catch {
      logout.disabled = false;
      logout.textContent = 'Tentar sair novamente';
    }
  });
})();
