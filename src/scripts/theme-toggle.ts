import { THEME_KEY } from '../lib/theme';

type Theme = 'light' | 'dark';

const root = document.documentElement;
const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme(): Theme {
  const picked = root.dataset.theme;
  if (picked === 'light' || picked === 'dark') return picked;
  return deviceDark.matches ? 'dark' : 'light';
}

function updateLabels(): void {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', `Switch to ${next} theme`);
  }
}

function remember(theme: Theme | null): void {
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-theme-toggle]')) {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    remember(next);
  } else if (event.target.closest('[data-theme-reset]')) {
    delete root.dataset.theme;
    remember(null);
    for (const status of document.querySelectorAll('[data-theme-status]')) {
      status.textContent = 'Done. The site now follows your device setting.';
    }
  } else {
    return;
  }
  updateLabels();
});

deviceDark.addEventListener('change', updateLabels);
updateLabels();
