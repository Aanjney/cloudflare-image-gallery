import { ADMIN_BACKFILL_VARIANT, ADMIN_THUMB_VARIANT } from '../domain/imageVariants';
import { buildBrowserPlaceholderColorHelper } from '../domain/placeholderColor';
import { UPLOAD_FORMAT_LABEL } from '../domain/uploadPolicy';
import { buildAdminManageScript } from './adminManage';
import { buildAdminUploadScript } from './adminUpload';
import {
  emitBrowserAltHelper,
  emitBrowserFetchHelper,
  emitBrowserImageUrlHelpers,
  emitBrowserPageWalker,
  emitThemeToggle,
  wrapClientIife,
} from './buildClientScript';

export function buildAdminScript(adminPrefix: string): string {
  const adminThumbVariant = JSON.stringify(ADMIN_THUMB_VARIANT);
  const adminBackfillVariant = JSON.stringify(ADMIN_BACKFILL_VARIANT);
  const uploadFormatLabel = JSON.stringify(UPLOAD_FORMAT_LABEL);

  return wrapClientIife(`  var ADMIN = '${adminPrefix}';
  var byId = function(id){ return document.getElementById(id); };
  var ADMIN_THUMB_VARIANT = ${adminThumbVariant};
  var ADMIN_BACKFILL_VARIANT = ${adminBackfillVariant};
  var UPLOAD_FORMAT_LABEL = ${uploadFormatLabel};
${emitBrowserImageUrlHelpers()}
${buildBrowserPlaceholderColorHelper()}
${emitBrowserAltHelper()}
${emitBrowserFetchHelper()}
${emitBrowserPageWalker()}

  /* ── Sidebar ── */
  var sidebar = byId('sidebar');
  var mobileToggle = byId('mobileToggle');
  var setSidebarOpen = function(open){
    sidebar.classList.toggle('open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
  };
  mobileToggle.addEventListener('click', function(){ setSidebarOpen(!sidebar.classList.contains('open')); });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' || !sidebar.classList.contains('open')) return;
    setSidebarOpen(false);
    mobileToggle.focus();
  });
  var narrowViewport = window.matchMedia('(max-width: 960px)');
  var closeSidebar = function(){ setSidebarOpen(false); };
  if (narrowViewport.addEventListener) narrowViewport.addEventListener('change', closeSidebar);
  else narrowViewport.addListener(closeSidebar);

  /* ── Theme toggle ── */
${emitThemeToggle()}

  /* ── Tabs ── */
  var tabs = document.querySelectorAll('.sidebar-nav .nav-item');
  var tabUpload = byId('tab-upload');
  var tabManage = byId('tab-manage');
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      tabs.forEach(function(b){
        b.classList.toggle('active', b === btn);
        if (b === btn) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      var tab = btn.getAttribute('data-tab');
      tabUpload.style.display = tab === 'upload' ? 'block' : 'none';
      tabManage.style.display = tab === 'manage' ? 'block' : 'none';
      setSidebarOpen(false);
    });
  });
${buildAdminUploadScript()}
${buildAdminManageScript()}
  renderQueue();
  loadManagePage(null);
  loadBucketStats();`);
}
