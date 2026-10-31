(() => {
  const button = document.querySelector('#copyEnrollmentLink');
  const link = document.querySelector('#enrollmentShareLink');
  const status = document.querySelector('#enrollmentShareStatus');
  if (!button || !link || !status) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '';
    let copied = false;
    try {
      await navigator.clipboard.writeText(link.value);
      copied = true;
    } catch {
      // Older browsers or denied clipboard permission: use the visible public link.
      link.focus();
      link.select();
      link.setSelectionRange(0, link.value.length);
      try {
        copied = document.execCommand('copy');
      } catch { /* Keep the link selected for manual copying. */ }
    }
    button.disabled = false;
    button.textContent = copied ? 'Link copiado!' : 'Copiar link';
    status.textContent = copied
      ? 'Link copiado. Compartilhe com quem deseja se inscrever.'
      : 'Não foi possível copiar automaticamente. Selecione o link acima e copie manualmente.';
    if (copied) button.focus();
  });
})();
