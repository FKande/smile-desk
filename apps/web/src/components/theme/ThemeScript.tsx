/* Runs before first paint so a stored theme or text size never flashes in
 * after hydration. Keys must match components/theme/preferences.ts (that
 * module is client-only, so the strings are repeated here on purpose).
 *
 * Why a raw inline <script>: it is the only thing that runs before paint.
 * next/script's beforeInteractive queues inline code for Next's bootstrap,
 * which runs later and would flash the wrong theme. dangerouslySetInnerHTML
 * is safe here: the string is a constant with no user input. React logs a
 * dev warning only if the root layout is ever rendered client-side (after a
 * server error); a normal load server-renders and hydrates it untouched. */
const script = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("smile-desk:theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var s=localStorage.getItem("smile-desk:text-size");if(s==="large"||s==="larger")d.setAttribute("data-text-size",s);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
