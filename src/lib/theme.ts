/** Browser storage key for the theme the visitor picked ("light" or "dark"). */
export const THEME_KEY = 'theme';

/**
 * Runs inline in <head> before the first paint: marks that scripts run, so
 * script-only controls can show, and applies a theme picked earlier.
 * The build adds its hash to the CSP. Keep it to one short line.
 */
export const themeInit = `document.documentElement.classList.add('js');try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
