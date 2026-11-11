import { DESCRIPTIVE_FIELDS, META_FIELDS } from '../../domain/imageMeta';
import { buildBrowserPlaceholderColorHelper } from '../../domain/placeholderColor';
import { buildBrowserImageUrlHelper } from '../../domain/imageVariants';
import {
  emitBrowserByIdHelper,
  emitBrowserFetchHelper,
  emitBrowserPageWalker,
  wrapClientIife,
} from '../shared/script';
import { emitThemeToggle } from '../shared/theme';
import { buildAdminManageScript } from './manage';
import { ID } from './markup';
import { DRAWER_QUERY, THEME_COLORS } from './styles';
import { buildAdminUploadScript } from './upload';

const FIELDS = DESCRIPTIVE_FIELDS.map((name) => ({
  name,
  label: META_FIELDS[name].label,
  placeholder: `e.g. ${META_FIELDS[name].example}`,
  maxLength: META_FIELDS[name].maxLength,
}));

export function buildAdminScript(adminPrefix: string): string {
  return wrapClientIife(`  var ADMIN = ${JSON.stringify(adminPrefix)};
  var FIELDS = ${JSON.stringify(FIELDS)};
${emitBrowserByIdHelper()}
${buildBrowserImageUrlHelper()}
${buildBrowserPlaceholderColorHelper()}
  function altFromMeta(meta, fallback) {
    var parts = [meta.filmStock, meta.cameraBody, meta.location, meta.year].filter(Boolean);
    return parts.length ? 'Film photograph: ' + parts.join(', ') : fallback;
  }
  function cleanField(v) { return String(v || '').trim().toUpperCase(); }
${emitBrowserFetchHelper()}
${emitBrowserPageWalker()}
${emitThemeToggle(THEME_COLORS)}
${buildAdminUploadScript()}
${buildAdminManageScript()}

  var sidebar = byId('${ID.sidebar}');
  var mobileToggle = byId('${ID.mobileToggle}');
  function setSidebarOpen(open) {
    sidebar.classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
  }
  function closeSidebar() { setSidebarOpen(false); }
  mobileToggle.addEventListener('click', function(){ setSidebarOpen(!sidebar.classList.contains('open')); });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' || !sidebar.classList.contains('open')) return;
    setSidebarOpen(false);
    mobileToggle.focus();
  });
  byId('${ID.sidebarScrim}').addEventListener('click', closeSidebar);
  window.matchMedia('${DRAWER_QUERY}').addEventListener('change', closeSidebar);

  initThemeToggle();

  var tabs = document.querySelectorAll('[data-tab]');
  var panels = ${JSON.stringify([ID.tabUpload, ID.tabManage])}.map(byId);
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      tabs.forEach(function(b){
        b.classList.toggle('active', b === btn);
        if (b === btn) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      var tab = btn.getAttribute('data-tab');
      panels.forEach(function(p){ p.hidden = p.id !== tab; });
      setSidebarOpen(false);
    });
  });

  initUpload();
  initManage();`);
}
