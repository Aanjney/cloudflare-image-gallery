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
<style>
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
</style>
</head>
<body>

<button class="mobile-toggle" type="button" aria-label="Toggle sidebar" id="mobileToggle">
  <span class="material-symbols-outlined">menu</span>
</button>

<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand"></div>
  <nav class="sidebar-nav" aria-label="Admin navigation">
    <button class="nav-item active" data-tab="upload" type="button">
      <span class="material-symbols-outlined">add_a_photo</span><span>Upload</span>
    </button>
    <button class="nav-item" data-tab="manage" type="button">
      <span class="material-symbols-outlined">grid_view</span><span>Manage</span>
    </button>
  </nav>
  <div class="sidebar-footer">
    <a href="/" class="nav-item"><span class="material-symbols-outlined">home</span><span>View Gallery</span></a>
  </div>
</aside>

<header class="top-bar">
  <div></div>
  <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light/dark mode">
    <span class="material-symbols-outlined icon-dark">dark_mode</span>
    <span class="material-symbols-outlined icon-light">light_mode</span>
  </button>
</header>

<main class="main-content">
  <!-- ═══ UPLOAD TAB ═══ -->
  <section id="tab-upload" class="tab-panel">
    <header class="section-header">
      <div class="breadcrumbs">Dashboard / Upload</div>
      <h2>Upload</h2><div class="header-line"></div>
    </header>
    <div id="dropArea" class="drop-zone">
      <div class="drop-zone-hl"></div>
      <span class="material-symbols-outlined drop-icon">cloud_upload</span>
      <h3>Drag negatives here</h3><p>JPG, PNG, WebP</p>
      <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div><div class="corner corner-br"></div>
      <input id="filePicker" type="file" accept="image/*" multiple style="display:none" />
    </div>
    <div class="queue-header">
      <h3>Pending Queue (<span id="queueCount">0</span>)</h3>
      <div class="queue-actions-bar">
        <button id="clearQueue" type="button" class="btn-ghost">Clear All</button>
      </div>
    </div>
    <div id="uploadProgress" class="upload-progress" style="display:none">
      <div class="upload-progress-header">
        <span class="upload-progress-label" id="uploadLabel">Uploading</span>
        <span class="upload-progress-count" id="uploadCount"></span>
      </div>
      <div class="upload-progress-track"><div class="upload-progress-fill" id="uploadFill"></div></div>
      <span class="upload-progress-status" id="uploadStatus" role="status" aria-live="polite"></span>
    </div>
    <div id="queueList" class="queue-list"></div>
    <div class="upload-footer">
      <button id="startUpload" type="button" class="btn-primary-lg">Upload to Archive</button>
    </div>
  </section>

  <!-- ═══ MANAGE TAB ═══ -->
  <section id="tab-manage" class="tab-panel" style="display:none">
    <header class="section-header">
      <div class="breadcrumbs">Dashboard / Manage</div><h2>Manage</h2>
      <div class="header-line"></div>
    </header>
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card stat-card-alt"><p class="stat-label">Total Shots</p><p class="stat-value" id="statTotal">&mdash;</p></div>
      <div class="stat-card"><p class="stat-label">Storage Used</p><p class="stat-value" id="statStorage">&mdash;</p></div>
      <div class="stat-card stat-card-alt"><p class="stat-label">Latest Upload</p><p class="stat-value" id="statLatest">&mdash;</p></div>
      <div class="stat-card"><p class="stat-label">Avg Size</p><p class="stat-value" id="statAvgSize">&mdash;</p></div>
    </div>
    <div class="manage-toolbar">
      <div class="search-box"><span class="material-symbols-outlined">search</span><input id="searchInput" type="text" placeholder="Search archive..." /></div>
      <div class="toolbar-actions">
        <span id="manageError" class="error-text" aria-live="assertive" role="status"></span>
        <button id="backfillPlaceholders" class="btn-ghost" type="button">Backfill Colors</button>
      </div>
    </div>
    <div class="manage-table-wrap">
      <table class="manage-table">
        <thead><tr>
          <th>Preview</th><th>Location / Year</th><th>Size</th><th>Uploaded</th><th class="text-right">Actions</th>
        </tr></thead>
        <tbody id="manageBody"></tbody>
      </table>
    </div>
    <div id="manageEmpty" class="empty-state" style="display:none">No items found in archive.</div>
    <footer class="manage-footer">
      <span id="pageInfo" class="page-info"></span>
      <div class="manage-footer-nav">
        <button id="prevPage" class="btn-ghost" type="button">Previous</button>
        <button id="nextPage" class="btn-ghost" type="button">Next</button>
      </div>
    </footer>
  </section>
</main>

<script>
(function(){
  var ADMIN = '${adminPrefix}';
  var qs = function(id){ return document.getElementById(id); };

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

  /* ── Upload ── */
  var queueList = qs('queueList');
  var dropArea = qs('dropArea');
  var filePicker = qs('filePicker');
  var clearQueueBtn = qs('clearQueue');
  var startUploadBtn = qs('startUpload');
  var queueCountEl = qs('queueCount');
  var uploadStatus = qs('uploadStatus');
  var queue = [];
  var thumbUrl = function(id){ return '/img/' + id + '?w=160&q=75&fmt=webp'; };
  var originalUrl = function(id){ return '/media/' + id; };

  var renderQueue = function(){
    queueList.innerHTML = '';
    queueCountEl.textContent = String(queue.length);
    if (!queue.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No files queued yet. Drag images above or click to select.';
      queueList.appendChild(empty);
      return;
    }
    queue.forEach(function(item, idx){
      var row = document.createElement('div');
      row.className = 'queue-item';
      var previewWrap = document.createElement('div');
      previewWrap.className = 'queue-item-preview';
      var img = document.createElement('img');
      img.src = item.preview || '';
      img.alt = item.file.name;
      previewWrap.appendChild(img);
      var fileLabel = document.createElement('div');
      fileLabel.className = 'queue-item-file-label';
      fileLabel.textContent = item.file.name;
      previewWrap.appendChild(fileLabel);
      row.appendChild(previewWrap);

      var fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'queue-item-fields';
      var grid = document.createElement('div');
      grid.className = 'fields-grid';
      var mkField = function(label, field, placeholder, val) {
        var g = document.createElement('div');
        g.className = 'field-group';
        var l = document.createElement('label');
        l.textContent = label;
        g.appendChild(l);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = placeholder || '';
        inp.value = val || '';
        inp.setAttribute('data-field', field);
        inp.setAttribute('data-idx', String(idx));
        g.appendChild(inp);
        return g;
      };
      grid.appendChild(mkField('Camera Body', 'cameraBody', 'e.g. Leica M6', item.cameraBody));
      grid.appendChild(mkField('Film Stock', 'filmStock', 'e.g. Kodak Portra 400', item.filmStock));
      grid.appendChild(mkField('Location', 'location', 'e.g. Faroe Islands', item.location));
      grid.appendChild(mkField('Year', 'year', 'e.g. 2024', item.year));
      fieldsWrap.appendChild(grid);

      var actions = document.createElement('div');
      actions.className = 'queue-item-actions';
      if (item.status && item.status !== 'Queued') {
        var badge = document.createElement('span');
        badge.className = 'status-badge';
        if (item.status === 'Done') badge.classList.add('done');
        if (item.status.startsWith('Error')) badge.classList.add('error');
        badge.textContent = item.status;
        if (item.message) badge.title = item.message;
        actions.appendChild(badge);
      }
      var removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger-text';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<span class="material-symbols-outlined">delete</span> Remove';
      (function(i){ removeBtn.addEventListener('click', function(){ queue = queue.filter(function(_,ix){ return ix !== i; }); renderQueue(); }); })(idx);
      actions.appendChild(removeBtn);
      fieldsWrap.appendChild(actions);
      row.appendChild(fieldsWrap);
      queueList.appendChild(row);
    });
    queueList.querySelectorAll('input[data-field]').forEach(function(input){
      input.addEventListener('input', function(){
        var field = input.getAttribute('data-field');
        var i = Number(input.getAttribute('data-idx'));
        if (queue[i]) queue[i][field] = input.value;
      });
    });
  };

  var getImageMeta = function(file){
    return new Promise(function(resolve){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        var placeholder = '#0e0e0e';
        try {
          var c = document.createElement('canvas'), ctx = c.getContext('2d'), s = 12;
          c.width = s; c.height = s; ctx.drawImage(img, 0, 0, s, s);
          var d = ctx.getImageData(0, 0, s, s).data;
          var r=0,g=0,b=0,t=s*s;
          for (var i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}
          placeholder='rgb('+Math.round(r/t)+','+Math.round(g/t)+','+Math.round(b/t)+')';
        } catch(_){}
        resolve({width:img.naturalWidth||'',height:img.naturalHeight||'',preview:url,placeholder:placeholder});
      };
      img.onerror = function(){ resolve({width:'',height:'',preview:url,placeholder:'#0e0e0e'}); };
      img.src = url;
    });
  };

  var addFiles = function(files){
    var arr = Array.from(files), valid = [];
    for (var i=0;i<arr.length;i++){
      if (!arr[i].type.startsWith('image/')){ uploadStatus.textContent = 'Skipping non-image: '+arr[i].name; continue; }
      valid.push(arr[i]);
    }
    Promise.all(valid.map(function(f){return getImageMeta(f);})).then(function(metas){
      metas.forEach(function(meta,i){
        queue.push({
          file:valid[i], cameraBody:'', filmStock:'', location:'', year:'',
          width:meta.width, height:meta.height, preview:meta.preview,
          placeholder:meta.placeholder, status:'Queued'
        });
      });
      renderQueue();
    });
  };

  dropArea.addEventListener('click', function(){ filePicker.click(); });
  dropArea.addEventListener('dragover', function(e){ e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', function(){ dropArea.classList.remove('dragover'); });
  dropArea.addEventListener('drop', function(e){ e.preventDefault(); dropArea.classList.remove('dragover'); if (e.dataTransfer&&e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  filePicker.addEventListener('change', function(){ if (filePicker.files&&filePicker.files.length) addFiles(filePicker.files); });
  clearQueueBtn.addEventListener('click', function(){
    queue=[]; uploadStatus.textContent=''; uploadProgress.style.display='none';
    uploadTotal=0; uploadDone=0; uploadErrors=0; uploadFill.style.width='0%';
    renderQueue();
  });

  var uploadProgress = qs('uploadProgress');
  var uploadLabel = qs('uploadLabel');
  var uploadCount = qs('uploadCount');
  var uploadFill = qs('uploadFill');
  var uploadTotal = 0;
  var uploadDone = 0;
  var uploadErrors = 0;

  var updateProgress = function(currentName) {
    uploadProgress.style.display = 'block';
    var pct = uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0;
    uploadFill.style.width = pct + '%';
    uploadCount.textContent = uploadDone + ' / ' + uploadTotal;
    if (uploadDone < uploadTotal) {
      uploadLabel.textContent = 'Uploading';
      uploadStatus.className = 'upload-progress-status';
      uploadStatus.textContent = currentName || '';
    }
  };

  var uploadNext = function(){
    var idx = -1;
    for (var i=0;i<queue.length;i++){ if (queue[i].status==='Queued'||queue[i].status==='Error'){idx=i;break;} }
    if (idx === -1){
      uploadLabel.textContent = uploadErrors ? 'Completed with errors' : 'Complete';
      uploadStatus.className = 'upload-progress-status ' + (uploadErrors ? 'error' : 'done');
      uploadStatus.textContent = uploadErrors
        ? uploadErrors + ' failed, ' + (uploadDone - uploadErrors) + ' uploaded'
        : uploadDone + ' image' + (uploadDone !== 1 ? 's' : '') + ' uploaded successfully';
      uploadFill.style.width = '100%';
      queue=[]; renderQueue();
      return;
    }
    var item = queue[idx];
    queue[idx].status='Uploading'; renderQueue();
    updateProgress(item.file.name);
    var fd = new FormData();
    fd.append('file', item.file);
    fd.append('name', item.file.name);
    var altParts = [];
    if (item.filmStock) altParts.push(item.filmStock);
    if (item.cameraBody) altParts.push(item.cameraBody);
    if (item.location) altParts.push(item.location);
    if (item.year) altParts.push(item.year);
    fd.append('alt', altParts.length ? 'Film photograph' + (altParts.length ? ' \\u2014 ' + altParts.join(', ') : '') : item.file.name);
    if (item.width) fd.append('width', String(item.width));
    if (item.height) fd.append('height', String(item.height));
    if (item.placeholder) fd.append('placeholder', item.placeholder);
    if (item.cameraBody) fd.append('cameraBody', item.cameraBody.toUpperCase());
    if (item.filmStock) fd.append('filmStock', item.filmStock.toUpperCase());
    if (item.location) fd.append('location', item.location.toUpperCase());
    if (item.year) fd.append('year', item.year.toUpperCase());
    fetch(ADMIN+'/api/upload',{method:'POST',body:fd})
      .then(function(resp){ return resp.json().catch(function(){return {};}).then(function(data){
        uploadDone++;
        if (!resp.ok||!data.ok){ queue[idx].status='Error'; queue[idx].message=data.error||'Upload failed'; uploadErrors++; }
        else { queue[idx].status='Done'; queue[idx].message=(data.image&&data.image.id)||''; }
        updateProgress('');
        renderQueue(); uploadNext();
      }); })
      .catch(function(err){ uploadDone++; uploadErrors++; queue[idx].status='Error'; queue[idx].message=err&&err.message?err.message:String(err); updateProgress(''); renderQueue(); uploadNext(); });
  };

  startUploadBtn.addEventListener('click', function(){
    var pending = queue.filter(function(q){ return q.status === 'Queued' || q.status === 'Error'; });
    if (!pending.length) return;
    uploadTotal = pending.length;
    uploadDone = 0;
    uploadErrors = 0;
    updateProgress(pending[0].file.name);
    uploadNext();
  });

  /* ── Manage ── */
  var manageBody = qs('manageBody');
  var manageEmpty = qs('manageEmpty');
  var prevPageBtn = qs('prevPage');
  var nextPageBtn = qs('nextPage');
  var pageInfo = qs('pageInfo');
  var manageError = qs('manageError');
  var searchInput = qs('searchInput');
  var backfillBtn = qs('backfillPlaceholders');
  var manageItems = [];
  var currentCursor = null;
  var nextCursor = null;
  var prevStack = [];
  var pageSize = 10;
  var editingId = null;

  var fmtDate = function(iso){
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };

  var renderManage = function(){
    var term = (searchInput.value||'').toLowerCase();
    manageBody.innerHTML = '';
    if (pageInfo){ pageInfo.textContent = 'Page ' + (prevStack.length+1) + (nextCursor ? ' \\u2192' : ''); }
    var filtered = manageItems.filter(function(item){
      var hay = (item.name||'')+' '+(item.alt||'')+' '+(item.location||'')+' '+(item.filmStock||'')+' '+(item.cameraBody||'')+' '+item.id;
      return hay.toLowerCase().indexOf(term) !== -1;
    });
    manageEmpty.style.display = filtered.length ? 'none' : 'block';

    filtered.forEach(function(item){
      var tr = document.createElement('tr');

      /* Thumb */
      var thumbTd = document.createElement('td');
      var thumbDiv = document.createElement('div');
      thumbDiv.className = 'manage-thumb';
      var img = document.createElement('img');
      img.src = thumbUrl(item.id);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onerror = function(){ img.src = originalUrl(item.id); };
      img.alt = item.name || 'Image';
      thumbDiv.appendChild(img);
      thumbTd.appendChild(thumbDiv);
      tr.appendChild(thumbTd);

      /* Location / Year */
      var locTd = document.createElement('td');
      var locParts = [];
      if (item.location) locParts.push(item.location);
      if (item.year) locParts.push(item.year);
      var titleDiv = document.createElement('div');
      titleDiv.className = 'manage-title';
      titleDiv.textContent = locParts.join(', ') || '\\u2014';
      locTd.appendChild(titleDiv);
      if (item.filmStock || item.cameraBody) {
        var subDiv = document.createElement('div');
        subDiv.className = 'manage-subtitle';
        var sub = [];
        if (item.cameraBody) sub.push(item.cameraBody);
        if (item.filmStock) sub.push(item.filmStock);
        subDiv.textContent = sub.join(' \\u2022 ');
        locTd.appendChild(subDiv);
      }
      tr.appendChild(locTd);

      /* Size */
      var sizeTd = document.createElement('td');
      sizeTd.className = 'manage-meta';
      sizeTd.textContent = item.size ? Math.round(item.size/1024)+' KB' : '';
      tr.appendChild(sizeTd);

      /* Date */
      var dateTd = document.createElement('td');
      dateTd.className = 'manage-meta';
      dateTd.textContent = fmtDate(item.createdAt);
      tr.appendChild(dateTd);

      /* Actions */
      var actionsTd = document.createElement('td');
      actionsTd.className = 'manage-actions';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn-icon'; copyBtn.type = 'button'; copyBtn.title = 'Copy link';
      copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
      (function(iid){ copyBtn.addEventListener('click', function(){
        navigator.clipboard.writeText(window.location.origin+'/media/'+iid).then(function(){
          manageError.textContent='Link copied';
          setTimeout(function(){if(manageError.textContent==='Link copied')manageError.textContent='';},1200);
        }).catch(function(){prompt('Copy link:',window.location.origin+'/media/'+iid);});
      }); })(item.id);
      actionsTd.appendChild(copyBtn);

      var editBtn = document.createElement('button');
      editBtn.className = 'btn-icon'; editBtn.type = 'button'; editBtn.title = 'Edit metadata';
      editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
      (function(itm, rowEl){
        editBtn.addEventListener('click', function(){ showEditRow(itm, rowEl); });
      })(item, tr);
      actionsTd.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger'; delBtn.type = 'button'; delBtn.title = 'Delete';
      delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
      (function(iid){
        delBtn.addEventListener('click', function(){
          if (!confirm('Delete this image permanently?')) return;
          delBtn.disabled = true;
          fetch(ADMIN+'/api/images/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:iid})})
            .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
              if(!r.ok||!d.ok){alert('Delete failed: '+(d.error||r.status));delBtn.disabled=false;return;}
              manageItems=manageItems.filter(function(x){return x.id!==iid;});renderManage();
            }); }).catch(function(){alert('Delete failed');delBtn.disabled=false;});
        });
      })(item.id);
      actionsTd.appendChild(delBtn);
      tr.appendChild(actionsTd);
      manageBody.appendChild(tr);
    });
  };

  /* ── Inline edit row ── */
  var showEditRow = function(item, afterRow){
    var existing = document.querySelector('.edit-row');
    if (existing) existing.remove();
    if (editingId === item.id) { editingId = null; return; }
    editingId = item.id;

    var editTr = document.createElement('tr');
    editTr.className = 'edit-row';
    var td = document.createElement('td');
    td.colSpan = 5;

    var form = document.createElement('div');
    form.className = 'edit-form';
    var fields = [
      {label:'Camera Body',field:'cameraBody',val:item.cameraBody||'',ph:'e.g. Leica M6'},
      {label:'Film Stock',field:'filmStock',val:item.filmStock||'',ph:'e.g. Kodak Portra 400'},
      {label:'Location',field:'location',val:item.location||'',ph:'e.g. Faroe Islands'},
      {label:'Year',field:'year',val:item.year||'',ph:'e.g. 2024'}
    ];
    var inputs = {};
    fields.forEach(function(f){
      var g = document.createElement('div');
      g.className = 'field-group';
      var l = document.createElement('label');
      l.textContent = f.label;
      g.appendChild(l);
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = f.val; inp.placeholder = f.ph;
      inputs[f.field] = inp;
      g.appendChild(inp);
      form.appendChild(g);
    });
    td.appendChild(form);

    var acts = document.createElement('div');
    acts.className = 'edit-actions';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save'; saveBtn.type = 'button'; saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function(){
      saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
      var body = {id:item.id};
      fields.forEach(function(f){ body[f.field] = inputs[f.field].value.trim().toUpperCase(); });
      var altParts = [];
      if (body.filmStock) altParts.push(body.filmStock);
      if (body.cameraBody) altParts.push(body.cameraBody);
      if (body.location) altParts.push(body.location);
      if (body.year) altParts.push(body.year);
      body.alt = altParts.length ? 'Film photograph \\u2014 ' + altParts.join(', ') : (item.name || 'Film photograph');
      fetch(ADMIN+'/api/images/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){ return r.json().then(function(d){
          if (!r.ok||!d.ok){ alert('Update failed'); saveBtn.disabled=false; saveBtn.textContent='Save'; return; }
          var updated = d.image;
          for (var i=0;i<manageItems.length;i++){
            if (manageItems[i].id===item.id){ manageItems[i]=updated; break; }
          }
          editingId = null; renderManage();
          manageError.textContent = 'Updated'; setTimeout(function(){if(manageError.textContent==='Updated')manageError.textContent='';},1200);
        }); }).catch(function(){ alert('Update failed'); saveBtn.disabled=false; saveBtn.textContent='Save'; });
    });
    acts.appendChild(saveBtn);
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function(){ editingId=null; editTr.remove(); });
    acts.appendChild(cancelBtn);
    td.appendChild(acts);
    editTr.appendChild(td);
    afterRow.after(editTr);
  };

  var loadAllManage = function(){
    return new Promise(function(resolve){
      var seen=[],pg=null;
      var doP=function(){
        var p=new URLSearchParams();p.set('limit','50');if(pg)p.set('cursor',pg);
        fetch('/api/images?'+p.toString()).then(function(r){return r.json();}).then(function(d){
          seen=seen.concat(d.items||[]);pg=d.cursor||null;if(pg)doP();else resolve(seen);
        }).catch(function(){resolve(seen);});
      };doP();
    });
  };

  var updateStats = function(items){
    if (!items.length) return;
    qs('statTotal').textContent = String(items.length);
    var totalBytes = items.reduce(function(s,i){return s+(i.size||0);},0);
    qs('statStorage').textContent = (totalBytes/(1024*1024)).toFixed(1)+' MB';
    var dates = items.filter(function(i){return i.createdAt;}).map(function(i){return new Date(i.createdAt);});
    if (dates.length) qs('statLatest').textContent = fmtDate(new Date(Math.max.apply(null,dates)).toISOString());
    qs('statAvgSize').textContent = items.length ? Math.round(totalBytes/items.length/1024)+' KB' : '\\u2014';
  };

  var statsLoaded = false;
  var loadBucketStats = function(){
    if (statsLoaded) return;
    statsLoaded = true;
    loadAllManage().then(function(all){ updateStats(all); });
  };

  var loadManagePage = function(cursorParam){
    prevPageBtn.disabled=true; nextPageBtn.disabled=true;
    manageBody.innerHTML='<tr><td colspan="5" class="manage-meta" style="padding:2rem;text-align:center">Loading...</td></tr>';
    var qsP = new URLSearchParams();
    qsP.set('limit',String(pageSize));
    if (cursorParam) qsP.set('cursor',cursorParam);
    if (searchInput.value) qsP.set('q',searchInput.value);
    fetch('/api/images?'+qsP.toString()).then(function(resp){
      if (resp.status===401){manageError.textContent='Unauthorized. Please sign in via Cloudflare Access.';return;}
      return resp.json().then(function(data){
        manageItems=data.items||[]; currentCursor=cursorParam||null; nextCursor=data.cursor||null;
        prevPageBtn.disabled=prevStack.length===0; nextPageBtn.disabled=!nextCursor;
        manageError.textContent=''; renderManage();
        loadBucketStats();
      });
    }).catch(function(){manageError.textContent='Failed to load images';});
  };

  var searchTimer=null;
  searchInput.addEventListener('input',function(){
    if(searchTimer)clearTimeout(searchTimer);
    searchTimer=setTimeout(function(){ renderManage(); prevStack.length=0; loadManagePage(null); },200);
  });
  prevPageBtn.addEventListener('click',function(){ if(!prevStack.length)return; loadManagePage(prevStack.pop()||null); });
  nextPageBtn.addEventListener('click',function(){ if(!nextCursor)return; prevStack.push(currentCursor); loadManagePage(nextCursor); });

  /* ── Backfill ── */
  backfillBtn.addEventListener('click',function(){
    backfillBtn.disabled=true;backfillBtn.textContent='Working...';
    var cancelled=false,origClick=null;
    loadAllManage().then(function(all){
      var updated=0,processed=0;
      backfillBtn.textContent='Cancel';backfillBtn.disabled=false;
      origClick=backfillBtn.onclick;backfillBtn.onclick=function(){cancelled=true;};
      var next=function(i){
        if(cancelled||i>=all.length){
          renderManage();alert('Backfilled '+updated+' items.');
          backfillBtn.onclick=origClick;backfillBtn.disabled=false;backfillBtn.textContent='Backfill Colors';manageError.textContent='';return;
        }
        if(all[i].placeholder){next(i+1);return;}
        fetch('/img/'+all[i].id+'?w=120&q=70&fmt=auto').then(function(r){return r.blob();}).then(function(blob){
          var url=URL.createObjectURL(blob),img=new Image();
          img.onload=function(){
            var color='#0e0e0e';
            try{var c=document.createElement('canvas'),ctx=c.getContext('2d'),s=12;c.width=s;c.height=s;ctx.drawImage(img,0,0,s,s);var d=ctx.getImageData(0,0,s,s).data;var r2=0,g=0,b=0,t=s*s;for(var j=0;j<d.length;j+=4){r2+=d[j];g+=d[j+1];b+=d[j+2];}color='rgb('+Math.round(r2/t)+','+Math.round(g/t)+','+Math.round(b/t)+')';}catch(_){}
            URL.revokeObjectURL(url);
            fetch(ADMIN+'/api/images/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:all[i].id,placeholder:color})})
              .then(function(r){if(r.ok)updated++;processed++;manageError.textContent='Processed '+processed+'/'+all.length;next(i+1);})
              .catch(function(){processed++;next(i+1);});
          };
          img.onerror=function(){URL.revokeObjectURL(url);processed++;next(i+1);};img.src=url;
        }).catch(function(){processed++;next(i+1);});
      };next(0);
    }).catch(function(e){alert('Backfill failed: '+e);backfillBtn.disabled=false;backfillBtn.textContent='Backfill Colors';});
  });

  renderQueue();
  loadManagePage(null);
})();
</script>
</body>
</html>`;
}
