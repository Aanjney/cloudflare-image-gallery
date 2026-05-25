import { buildAdminBody } from './admin/markup';
import { buildAdminScript } from './admin/script';
import { buildAdminStyles } from './admin/styles';

export function buildAdminHTML(adminPrefix = '/_admin'): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin &mdash; Stills from my film camera</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#131313" />
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='16' y='6' width='32' height='52' rx='4' fill='%23333' stroke='%23fff' stroke-width='2'/%3E%3Crect x='20' y='2' width='24' height='8' rx='2' fill='%23555' stroke='%23fff' stroke-width='1.5'/%3E%3Ccircle cx='32' cy='34' r='12' fill='none' stroke='%23fff' stroke-width='2'/%3E%3Ccircle cx='32' cy='34' r='5' fill='%23fff'/%3E%3Crect x='22' y='14' width='6' height='4' rx='1' fill='%23888'/%3E%3Crect x='36' y='14' width='6' height='4' rx='1' fill='%23888'/%3E%3Crect x='20' y='50' width='24' height='4' rx='1' fill='%23555'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700;800;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
${buildAdminStyles()}
</head>
<body>
${buildAdminBody()}

${buildAdminScript(adminPrefix)}
</body>
</html>`;
}
