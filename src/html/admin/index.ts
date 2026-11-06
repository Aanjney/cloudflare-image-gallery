import { buildAdminBody } from './markup';
import { emitThemeBootstrap } from '../../client/buildClientScript';
import { buildAdminScript } from '../../client/admin';
import { buildAdminStyles } from './styles';

const THEME_COLORS = { dark: '#131313', light: '#f5f3f0' };

export function buildAdminHTML(adminPrefix = '/_admin'): string {
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
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=add_a_photo,cloud_upload,content_copy,dark_mode,delete,edit,grid_view,home,light_mode,menu,search&display=block" rel="stylesheet" />
${buildAdminStyles()}
</head>
<body>
${buildAdminBody()}

${buildAdminScript(adminPrefix)}
</body>
</html>`;
}
