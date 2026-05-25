import { UPLOAD_ACCEPT_ATTRIBUTE } from '../../domain/uploadPolicy';

export function buildAdminBody(): string {
  return `<button class="mobile-toggle" type="button" aria-label="Toggle sidebar" id="mobileToggle">
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
      <input id="filePicker" type="file" accept="${UPLOAD_ACCEPT_ATTRIBUTE}" multiple style="display:none" />
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
</main>`;
}
