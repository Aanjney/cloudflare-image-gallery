import { emitThemeBootstrap } from '../shared/theme';
import { ICON_NAMES, buildAdminBody } from './markup';
import { buildAdminScript } from './script';
import { THEME_COLORS, buildAdminStyles } from './styles';

export function buildAdminHTML(adminPrefix: string): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin · Stills from my film camera</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="${THEME_COLORS.dark}" />
${emitThemeBootstrap(THEME_COLORS)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${ICON_NAMES}&display=block" rel="stylesheet" />
${buildAdminStyles()}
</head>
<body>
${buildAdminBody()}

${buildAdminScript(adminPrefix)}
</body>
</html>`;
}
