import { buildGalleryBody } from './markup';
import { emitThemeBootstrap } from '../../client/buildClientScript';
import { buildGalleryScript } from '../../client/gallery';
import { buildGalleryStyles } from './styles';
import { GALLERY_FIRST_PAGE_PATH } from '../../domain/imageVariants';

const THEME_COLORS = { dark: '#000000', light: '#f5f3f0' };

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
<meta name="theme-color" content="${THEME_COLORS.dark}" />
${emitThemeBootstrap(THEME_COLORS)}
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Stills from my film camera" />
<meta property="og:description" content="A curated collection of photographs I took with my film camera." />
<meta property="og:url" content="${baseUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${baseUrl}" />
<link rel="preload" href="${GALLERY_FIRST_PAGE_PATH}" as="fetch" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700;900&family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@200..400,0&display=block&icon_names=calendar_today,camera_roll,chevron_left,chevron_right,close,content_copy,dark_mode,light_mode,location_on,photo_camera" rel="stylesheet" />
<script type="application/ld+json">${structuredData}</script>
${buildGalleryStyles()}
</head>
<body>
${buildGalleryBody()}
${buildGalleryScript()}
</body>
</html>`;
}
