import { buildBrowserImageUrlHelper } from '../domain/imageVariants';
import { buildBrowserPlaceholderColorHelper } from '../domain/placeholderColor';

export function wrapClientIife(body: string): string {
  return `<script>\n(function(){\n${body}\n})();\n</script>`;
}

export function emitBrowserImageUrlHelpers(): string {
  return `${buildBrowserImageUrlHelper()}
  var imageSrcset = function(id, variants) {
    return variants.map(function(variant) {
      return imageUrl(id, variant) + ' ' + variant.width + 'w';
    }).join(', ');
  };`;
}

export function emitBrowserPlaceholderHelper(): string {
  return buildBrowserPlaceholderColorHelper();
}

export function emitBrowserEscHelper(): string {
  return `  var esc = function(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };`;
}
