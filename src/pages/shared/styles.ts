export const RESET_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}`;

/** A page that sets `display` on `.material-symbols-outlined` must do so before this block. */
export const ICON_CSS = `.material-symbols-outlined{
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
  vertical-align:middle;
}
.icon-dark,.icon-light{display:none}
[data-theme="dark"] .icon-light{display:inline}
[data-theme="light"] .icon-dark{display:inline}`;

/**
 * Names the Material Symbols ligatures a page uses. `icon.x` is the ligature text, and
 * `iconNames` is the font request's `icon_names` value, so the font ships exactly these glyphs.
 */
export function iconSet<const N extends string>(names: readonly N[]) {
  const icon = Object.fromEntries(names.map((name) => [name, name])) as { [K in N]: K };
  return { icon, iconNames: [...names].sort().join(',') };
}
