import { ADMIN_BACKFILL_VARIANT, ADMIN_THUMB_VARIANT } from '../domain/imageVariants';
import { UPLOAD_FORMAT_LABEL } from '../domain/uploadPolicy';
import { buildAdminManageScript } from './adminManage';
import { buildAdminUploadScript } from './adminUpload';
import {
  emitBrowserImageUrlHelpers,
  emitBrowserPlaceholderHelper,
  wrapClientIife,
} from './buildClientScript';

export function buildAdminScript(adminPrefix: string): string {
  const adminThumbVariant = JSON.stringify(ADMIN_THUMB_VARIANT);
  const adminBackfillVariant = JSON.stringify(ADMIN_BACKFILL_VARIANT);
  const uploadFormatLabel = JSON.stringify(UPLOAD_FORMAT_LABEL);

  return wrapClientIife(`  var ADMIN = '${adminPrefix}';
  var qs = function(id){ return document.getElementById(id); };
  var ADMIN_THUMB_VARIANT = ${adminThumbVariant};
  var ADMIN_BACKFILL_VARIANT = ${adminBackfillVariant};
  var UPLOAD_FORMAT_LABEL = ${uploadFormatLabel};
${emitBrowserImageUrlHelpers()}
${emitBrowserPlaceholderHelper()}

  /* ── Sidebar ── */
  var sidebar = qs('sidebar');
  qs('mobileToggle').addEventListener('click', function(){ sidebar.classList.toggle('open'); });

  /* ── Theme toggle ── */
  var html = document.documentElement;
  var stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') html.setAttribute('data-theme', stored);
  qs('themeToggle').addEventListener('click', function(){
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  /* ── Tabs ── */
  var tabs = document.querySelectorAll('.sidebar-nav .nav-item');
  var tabUpload = qs('tab-upload');
  var tabManage = qs('tab-manage');
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      tabs.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      tabUpload.style.display = tab === 'upload' ? 'block' : 'none';
      tabManage.style.display = tab === 'manage' ? 'block' : 'none';
      if (window.innerWidth <= 960) sidebar.classList.remove('open');
    });
  });
${buildAdminUploadScript()}
${buildAdminManageScript()}
  renderQueue();
  loadManagePage(null);`);
}
