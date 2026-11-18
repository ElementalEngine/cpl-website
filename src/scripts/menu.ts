// Phone menu: a disclosure button that shows the main nav as a drawer under the header.
const button = document.querySelector<HTMLButtonElement>('[data-menu-button]');
const panel = document.getElementById(button?.getAttribute('aria-controls') ?? '');

if (button && panel) {
  const behind = document.querySelectorAll<HTMLElement>('[data-menu-inert]');
  const wide = window.matchMedia('(min-width: 64rem)');
  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  const setOpen = (open: boolean) => {
    button.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('data-open', open);
    for (const element of behind) element.inert = open;
  };

  button.addEventListener('click', () => {
    setOpen(!isOpen());
    if (isOpen()) panel.querySelector<HTMLElement>('a, button')?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });

  // Close before leaving, so a page restored with Back isn't left inert.
  panel.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
  });

  wide.addEventListener('change', () => {
    if (wide.matches) setOpen(false);
  });
}
