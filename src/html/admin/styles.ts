export function buildAdminStyles(): string {
  return `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root,[data-theme="dark"]{
  --bg:#131313;--surface:#1B1B1B;--surface-deep:#0e0e0e;
  --text:#e5e2e1;--text-heading:#fff;--text-dim:rgba(196,199,200,0.8);
  --text-muted:rgba(68,71,72,1);--text-faint:rgba(53,53,53,1);
  --border:rgba(68,71,72,0.2);--border-light:rgba(68,71,72,0.1);--border-subtle:rgba(255,255,255,0.05);
  --accent:#fff;--accent-gradient:linear-gradient(135deg,#fff,#c6c6c7);
  --nav-bg:rgba(19,19,19,0.7);
  --success:#86efac;--success-border:rgba(134,239,172,0.3);
  --error:#ffb4ab;--error-border:rgba(255,180,171,0.3);
  --hover-bg:#1B1B1B;--row-hover:#20201f;
  --selection-bg:#fff;--selection-text:#2f3131;
  --input-bg:transparent;
}
[data-theme="light"]{
  --bg:#f5f3f0;--surface:#e8e5e1;--surface-deep:#ddd9d4;
  --text:#3a3a3a;--text-heading:#1a1a1a;--text-dim:rgba(0,0,0,0.5);
  --text-muted:rgba(0,0,0,0.35);--text-faint:rgba(0,0,0,0.2);
  --border:rgba(0,0,0,0.1);--border-light:rgba(0,0,0,0.06);--border-subtle:rgba(0,0,0,0.04);
  --accent:#1a1a1a;--accent-gradient:linear-gradient(135deg,#1a1a1a,#444);
  --nav-bg:rgba(245,243,240,0.85);
  --success:#15803d;--success-border:rgba(21,128,61,0.3);
  --error:#dc2626;--error-border:rgba(220,38,38,0.3);
  --hover-bg:rgba(0,0,0,0.04);--row-hover:rgba(0,0,0,0.03);
  --selection-bg:#1a1a1a;--selection-text:#f5f3f0;
  --input-bg:transparent;
}

body{
  background:var(--bg);color:var(--text);
  font-family:'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;display:flex;min-height:100vh;
  transition:background 0.3s,color 0.3s;
}
::selection{background:var(--selection-bg);color:var(--selection-text)}
:focus-visible{outline:2px solid var(--text-muted);outline-offset:2px}
.material-symbols-outlined{
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
  vertical-align:middle;
}

/* ── Theme toggle ── */
.theme-toggle{
  background:none;border:none;cursor:pointer;padding:0;
  color:var(--text-muted);transition:color 0.3s;font-size:0;line-height:1;
}
.theme-toggle:hover{color:var(--text-heading)}
.theme-toggle .material-symbols-outlined{font-size:18px}
.icon-dark,.icon-light{display:none}
[data-theme="dark"] .icon-light{display:inline}
[data-theme="light"] .icon-dark{display:inline}

/* ── Sidebar ── */
.sidebar{
  position:fixed;left:0;top:0;height:100%;width:16rem;z-index:40;
  background:var(--bg);display:flex;flex-direction:column;
  padding:3rem 0 2.5rem;border-right:1px solid var(--border);transition:background 0.3s;
}
.sidebar-brand{padding:0 2rem;margin-bottom:1.5rem}
.sidebar-nav{flex:1;display:flex;flex-direction:column;gap:0.25rem;padding:0 0.75rem}
.nav-item{
  display:flex;align-items:center;gap:1rem;padding:0.75rem 1.25rem;
  font-family:'Epilogue',sans-serif;font-size:0.6875rem;font-weight:600;
  text-transform:uppercase;letter-spacing:0.1em;
  color:var(--text-muted);text-decoration:none;cursor:pointer;
  transition:all 0.3s;border:none;background:none;width:100%;text-align:left;
}
.nav-item:hover{color:var(--text-heading);background:var(--hover-bg)}
.nav-item.active{color:var(--text-heading);background:var(--hover-bg);border-left:2px solid var(--accent);padding-left:calc(1.25rem - 2px)}
.sidebar-footer{
  padding:0 0.75rem;border-top:1px solid var(--border);
  padding-top:1.5rem;display:flex;flex-direction:column;gap:0.25rem;
}

/* ── Top Bar ── */
.top-bar{
  position:fixed;top:0;right:0;left:16rem;z-index:50;
  display:flex;justify-content:space-between;align-items:center;
  padding:0 3rem;height:5rem;
  background:var(--nav-bg);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border-light);transition:background 0.3s;
}

/* ── Main ── */
.main-content{margin-left:16rem;padding:7rem 3rem 3rem;flex:1;min-height:100vh}
.section-header{margin-bottom:3rem}
.section-header .breadcrumbs{
  font-family:'Inter',sans-serif;font-size:0.6875rem;
  text-transform:uppercase;letter-spacing:0.2em;
  color:var(--text-muted);margin-bottom:1rem;
}
.section-header h2{
  font-family:'Epilogue',sans-serif;font-size:clamp(2rem,5vw,3.5rem);
  font-weight:900;letter-spacing:-0.03em;text-transform:uppercase;color:var(--text-heading);
}
.header-line{height:4px;width:6rem;background:var(--accent);margin-top:0.75rem}

/* ── Drop Zone ── */
.drop-zone{
  position:relative;width:100%;padding:6rem 2rem;margin-bottom:3rem;
  background:var(--surface);border:2px dashed var(--text-muted);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  cursor:pointer;transition:border-color 0.5s,background 0.5s;text-align:center;
}
.drop-zone:hover,.drop-zone.dragover{border-color:var(--accent)}
.drop-zone.dragover{background:var(--hover-bg)}
.drop-zone-hl{position:absolute;inset:0;background:var(--accent);opacity:0;transition:opacity 0.3s;pointer-events:none}
.drop-zone:hover .drop-zone-hl{opacity:0.02}
.drop-icon{font-size:3rem;margin-bottom:1.5rem;color:var(--text-muted);transition:color 0.3s}
.drop-zone:hover .drop-icon{color:var(--text-heading)}
.drop-zone h3{font-family:'Epilogue',sans-serif;font-size:1rem;font-weight:700;letter-spacing:0.05em;margin-bottom:0.5rem;text-transform:uppercase}
.drop-zone>p{font-family:'Inter',sans-serif;font-size:0.8rem;color:var(--text-dim);letter-spacing:0.05em}
.corner{position:absolute;width:1rem;height:1rem;transition:border-color 0.5s}
.corner-tl{top:1rem;left:1rem;border-top:2px solid var(--border);border-left:2px solid var(--border)}
.corner-tr{top:1rem;right:1rem;border-top:2px solid var(--border);border-right:2px solid var(--border)}
.corner-bl{bottom:1rem;left:1rem;border-bottom:2px solid var(--border);border-left:2px solid var(--border)}
.corner-br{bottom:1rem;right:1rem;border-bottom:2px solid var(--border);border-right:2px solid var(--border)}
.drop-zone:hover .corner,.drop-zone.dragover .corner{border-color:var(--accent)}

/* ── Queue ── */
.queue-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:2rem}
.queue-header h3{font-family:'Epilogue',sans-serif;font-size:1.25rem;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase}
.queue-actions-bar{display:flex;align-items:center;gap:1rem}
.queue-list{display:flex;flex-direction:column;gap:0}
.queue-item{
  display:grid;grid-template-columns:2fr 3fr;gap:3rem;
  padding:3rem 0;border-top:1px solid var(--border-subtle);
}
.queue-item:first-child{border-top:none;padding-top:0}
.queue-item-preview{aspect-ratio:3/2;background:var(--surface-deep);overflow:hidden;position:relative}
.queue-item-preview img{width:100%;height:100%;object-fit:cover;opacity:0.8;transition:opacity 0.7s}
.queue-item:hover .queue-item-preview img{opacity:1}
.queue-item-file-label{
  position:absolute;bottom:0;left:0;padding:0.75rem 1rem;
  background:var(--nav-bg);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  font-family:'Inter',sans-serif;font-size:0.625rem;letter-spacing:0.15em;color:var(--text-heading);text-transform:uppercase;
}
.queue-item-fields{display:flex;flex-direction:column;justify-content:space-between}
.fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem 2rem}
.field-group label{
  display:block;font-family:'Inter',sans-serif;font-size:0.625rem;font-weight:600;
  text-transform:uppercase;letter-spacing:0.2em;color:var(--text-dim);margin-bottom:0.5rem;
}
.field-group input,.field-group textarea{
  width:100%;background:var(--input-bg);border:none;border-bottom:1px solid var(--text-muted);
  padding:0.5rem 0;font-family:'Inter',sans-serif;font-size:0.875rem;color:var(--text-heading);
  outline:none;transition:border-color 0.3s;resize:none;
}
.field-group input:focus,.field-group textarea:focus{border-color:var(--accent)}
.field-group input::placeholder,.field-group textarea::placeholder{color:var(--text-faint)}
.queue-item-actions{display:flex;justify-content:flex-end;margin-top:1.5rem}

/* ── Buttons ── */
.btn-ghost{
  background:none;border:none;font-family:'Inter',sans-serif;font-size:0.6875rem;
  font-weight:600;text-transform:uppercase;letter-spacing:0.15em;
  color:var(--text-dim);cursor:pointer;transition:color 0.3s;padding:0.5rem 1rem;
}
.btn-ghost:hover{color:var(--text-heading)}
.btn-ghost:disabled{opacity:0.3;cursor:default}
.btn-danger-text{
  background:none;border:none;font-family:'Inter',sans-serif;font-size:0.6875rem;
  font-weight:600;text-transform:uppercase;letter-spacing:0.15em;
  color:var(--text-dim);cursor:pointer;transition:color 0.3s;
  display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;
}
.btn-danger-text:hover{color:var(--error)}
.btn-danger-text .material-symbols-outlined{font-size:0.875rem}
.btn-primary-lg{
  background:var(--accent-gradient);color:var(--bg);border:none;
  font-family:'Epilogue',sans-serif;font-size:0.8rem;font-weight:900;
  letter-spacing:0.3em;text-transform:uppercase;padding:1.5rem 4rem;cursor:pointer;transition:all 0.3s;
}
.btn-primary-lg:hover{opacity:0.85}
.btn-primary-lg:active{transform:scale(0.98)}
.btn-primary-lg:disabled{opacity:0.5;cursor:default}
.btn-icon{background:none;border:none;cursor:pointer;color:var(--text-muted);transition:color 0.3s;padding:0.25rem}
.btn-icon:hover{color:var(--text-heading)}
.btn-icon.danger:hover{color:var(--error)}

/* ── Upload Progress ── */
.upload-progress{
  background:var(--surface);padding:1.5rem 2rem;margin-bottom:2rem;
}
.upload-progress-header{
  display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.75rem;
}
.upload-progress-label{
  font-family:'Epilogue',sans-serif;font-size:0.6875rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.15em;color:var(--text-heading);
}
.upload-progress-count{
  font-family:'Inter',sans-serif;font-size:0.6875rem;font-weight:600;
  letter-spacing:0.1em;color:var(--text-dim);
}
.upload-progress-track{
  width:100%;height:3px;background:var(--text-muted);overflow:hidden;
}
.upload-progress-fill{
  height:100%;width:0%;background:var(--accent);
  transition:width 0.4s cubic-bezier(0.16,1,0.3,1);
}
.upload-progress-status{
  display:block;margin-top:0.75rem;
  font-family:'Inter',sans-serif;font-size:0.6875rem;font-weight:500;
  letter-spacing:0.05em;color:var(--text-dim);
}
.upload-progress-status.done{color:var(--success)}
.upload-progress-status.error{color:var(--error)}

/* ── Upload Footer ── */
.upload-footer{
  display:flex;flex-direction:column;align-items:center;gap:2rem;
  margin-top:4rem;padding-top:4rem;border-top:1px solid var(--border-subtle);
}

/* ── Stats Grid ── */
.stats-grid{
  display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:3rem;
  border:1px solid var(--border);
}
.stat-card{padding:2rem;border-right:1px solid var(--border)}
.stat-card:last-child{border-right:none}
.stat-card-alt{background:var(--surface)}
.stat-label{font-family:'Inter',sans-serif;font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.2em;color:var(--text-muted);margin-bottom:0.5rem}
.stat-value{font-family:'Epilogue',sans-serif;font-size:1.5rem;font-weight:700;color:var(--text-heading)}

/* ── Manage Toolbar ── */
.manage-toolbar{
  display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;gap:1rem;flex-wrap:wrap;
}
.search-box{display:flex;align-items:center;gap:0.75rem;background:var(--surface);padding:0.5rem 1rem}
.search-box .material-symbols-outlined{color:var(--text-dim);font-size:1rem}
.search-box input{
  background:transparent;border:none;font-family:'Epilogue',sans-serif;font-size:0.6875rem;
  letter-spacing:0.1em;text-transform:uppercase;color:var(--text-heading);outline:none;width:12rem;
}
.search-box input::placeholder{color:var(--text-muted)}
.toolbar-actions{display:flex;align-items:center;gap:1rem}
.error-text{font-family:'Inter',sans-serif;font-size:0.75rem;color:var(--error)}

/* ── Table ── */
.manage-table-wrap{background:var(--surface);overflow-x:auto}
.manage-table{width:100%;border-collapse:collapse}
.manage-table thead tr{background:var(--surface-deep);border-bottom:1px solid var(--border)}
.manage-table th{
  text-align:left;padding:1.25rem 1.5rem;font-family:'Inter',sans-serif;font-size:0.6875rem;
  text-transform:uppercase;letter-spacing:0.2em;font-weight:600;color:var(--text-muted);
}
.manage-table th.text-right{text-align:right}
.manage-table tbody tr{border-bottom:1px solid var(--border-light);transition:background 0.3s;content-visibility:auto;contain-intrinsic-size:auto 5rem}
.manage-table tbody tr:hover{background:var(--row-hover)}
.manage-table td{padding:1rem 1.5rem;vertical-align:middle}
.manage-thumb{width:4rem;height:5rem;background:var(--surface-deep);overflow:hidden;display:block}
.manage-thumb img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s}
.manage-table tbody tr:hover .manage-thumb img{transform:scale(1.1)}
.manage-title{font-family:'Epilogue',sans-serif;font-size:0.8rem;font-weight:700;letter-spacing:-0.01em;color:var(--text-heading)}
.manage-subtitle{font-family:'Inter',sans-serif;font-size:0.6875rem;color:var(--text-muted);margin-top:0.25rem;letter-spacing:0.05em;text-transform:uppercase}
.manage-meta{font-family:'Inter',sans-serif;font-size:0.75rem;color:var(--text-dim)}
.manage-actions{display:flex;justify-content:flex-end;gap:0.5rem;align-items:center}
.text-right{text-align:right}

/* ── Edit Row ── */
.edit-row td{background:var(--surface) !important;padding:1.5rem !important}
.edit-form{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem 2rem}
.edit-form .field-group{margin-bottom:0}
.edit-actions{display:flex;gap:1rem;margin-top:1.5rem;justify-content:flex-end}
.btn-save{
  background:var(--accent);color:var(--bg);border:none;padding:0.6rem 2rem;
  font-family:'Epilogue',sans-serif;font-size:0.6875rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.15em;cursor:pointer;transition:opacity 0.3s;
}
.btn-save:hover{opacity:0.85}
.btn-cancel{
  background:none;color:var(--text-dim);border:1px solid var(--border);
  padding:0.6rem 2rem;font-family:'Epilogue',sans-serif;font-size:0.6875rem;
  font-weight:700;text-transform:uppercase;letter-spacing:0.15em;cursor:pointer;transition:all 0.3s;
}
.btn-cancel:hover{color:var(--text-heading);border-color:var(--text-muted)}

/* ── Footer ── */
.manage-footer{
  display:flex;justify-content:space-between;align-items:center;
  background:var(--surface);padding:1.5rem 2rem;
}
.page-info{font-family:'Inter',sans-serif;font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.2em;color:var(--text-muted)}
.manage-footer-nav{display:flex;align-items:center;gap:0.5rem}
.empty-state{padding:3rem 2rem;font-family:'Inter',sans-serif;font-size:0.875rem;color:var(--text-dim);text-align:center}
.tab-panel{display:block}
.status-badge{
  display:inline-block;padding:0.15rem 0.6rem;font-family:'Inter',sans-serif;
  font-size:0.7rem;font-weight:600;letter-spacing:0.05em;color:var(--text-dim);
  border:1px solid var(--border);
}
.status-badge.done{color:var(--success);border-color:var(--success-border)}
.status-badge.error{color:var(--error);border-color:var(--error-border)}
.mobile-toggle{
  display:none;position:fixed;top:1.25rem;left:1rem;z-index:60;
  background:none;border:none;color:var(--text-heading);cursor:pointer;padding:0.5rem;
}
.mobile-toggle .material-symbols-outlined{font-size:24px}
@media(max-width:960px){
  .sidebar{transform:translateX(-100%);transition:transform 0.3s}
  .sidebar.open{transform:translateX(0)}
  .top-bar{left:0}
  .main-content{margin-left:0}
  .mobile-toggle{display:block}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .queue-item{grid-template-columns:1fr}
  .fields-grid{grid-template-columns:1fr}
  .edit-form{grid-template-columns:1fr 1fr}
  .manage-footer{flex-direction:column;gap:1rem;text-align:center}
}
@media(max-width:600px){
  .stats-grid{grid-template-columns:1fr}
  .manage-toolbar{flex-direction:column;align-items:stretch}
  .main-content{padding:6rem 1rem 2rem}
  .edit-form{grid-template-columns:1fr}
}
</style>`;
}
