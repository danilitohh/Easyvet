export function findUnlabeledFormControls(container: HTMLElement): Element[] {
  const labels = Array.from(container.querySelectorAll('label'));

  return Array.from(
    container.querySelectorAll('input:not([type="hidden"]), select, textarea'),
  ).filter((control) => {
    if (control.getAttribute('aria-label')?.trim()) return false;
    if (control.getAttribute('aria-labelledby')?.trim()) return false;
    if (control.closest('label')) return false;

    const id = control.getAttribute('id');
    return !id || !labels.some((label) => label.htmlFor === id);
  });
}

export function findUnnamedActions(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('button, a')).filter(
    (action) =>
      !action.getAttribute('aria-label')?.trim() &&
      !action.getAttribute('aria-labelledby')?.trim() &&
      !action.textContent?.trim(),
  );
}
