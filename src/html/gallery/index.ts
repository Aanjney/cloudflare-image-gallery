import { buildGalleryBody } from './markup';
import { buildGalleryScript } from './script';
import { buildGalleryStyles } from './styles';

export function buildGalleryHTML(baseUrl: string): string {
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'Stills from my film camera',
    description: 'A curated collection of photographs I took with my film camera.',
    url: baseUrl,
  });

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Stills from my film camera</title>
<meta name="description" content="A curated collection of photographs I took with my film camera." />
<meta name="theme-color" content="#000000" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Stills from my film camera" />
<meta property="og:description" content="A curated collection of photographs I took with my film camera." />
<meta property="og:url" content="${baseUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${baseUrl}" />
<link rel="preload" href="/api/images?limit=200" as="fetch" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
<script type="application/ld+json">${structuredData}</script>
${buildGalleryStyles()}
</head>
<body>
${buildGalleryBody()}
${buildGalleryScript()}
</body>
</html>`;
}
