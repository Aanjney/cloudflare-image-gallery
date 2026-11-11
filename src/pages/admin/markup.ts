import { UPLOAD_ACCEPT_ATTRIBUTE, UPLOAD_FORMAT_LABEL } from '../../domain/uploadPolicy';
import { iconSet } from '../shared/styles';
import { themeToggleButton } from '../shared/theme';

export const ID = {
  mobileToggle: 'mobileToggle',
  sidebar: 'sidebar',
  sidebarScrim: 'sidebarScrim',
  tabUpload: 'tab-upload',
  tabManage: 'tab-manage',
  dropArea: 'dropArea',
  filePicker: 'filePicker',
  queueCount: 'queueCount',
  clearQueue: 'clearQueue',
  uploadProgress: 'uploadProgress',
  uploadLabel: 'uploadLabel',
  uploadCount: 'uploadCount',
  uploadFill: 'uploadFill',
  uploadStatus: 'uploadStatus',
  queueList: 'queueList',
  startUpload: 'startUpload',
  statTotal: 'statTotal',
  statStorage: 'statStorage',
  statLatest: 'statLatest',
  statAvgSize: 'statAvgSize',
  statsError: 'statsError',
  searchInput: 'searchInput',
  manageError: 'manageError',
  backfillPlaceholders: 'backfillPlaceholders',
  manageBody: 'manageBody',
  manageEmpty: 'manageEmpty',
  pageInfo: 'pageInfo',
  prevPage: 'prevPage',
  nextPage: 'nextPage',
} as const;

export const LABEL = {
  upload: 'Upload to archive',
  backfill: 'Backfill colors',
} as const;

export const { icon: ICON, iconNames: ICON_NAMES } = iconSet([
  'add_a_photo',
  'cloud_upload',
  'content_copy',
  'dark_mode',
  'delete',
  'edit',
  'grid_view',
  'home',
  'light_mode',
  'menu',
  'search',
]);

export const MANAGE_COLUMNS = [
  '<th>Preview</th>',
  '<th>Location / Year</th>',
  '<th>Size</th>',
  '<th>Uploaded</th>',
  '<th class="text-right">Actions</th>',
];

export function buildAdminBody(): string {
  return `<button class="mobile-toggle" type="button" aria-label="Toggle sidebar" aria-controls="${ID.sidebar}" aria-expanded="false" id="${ID.mobileToggle}">
  <span aria-hidden="true" class="material-symbols-outlined">${ICON.menu}</span>
</button>

<aside class="sidebar" id="${ID.sidebar}">
  <nav class="sidebar-nav" aria-label="Admin navigation">
    <button class="nav-item active" data-tab="${ID.tabUpload}" type="button" aria-current="page">
      <span aria-hidden="true" class="material-symbols-outlined">${ICON.add_a_photo}</span><span>Upload</span>
    </button>
    <button class="nav-item" data-tab="${ID.tabManage}" type="button">
      <span aria-hidden="true" class="material-symbols-outlined">${ICON.grid_view}</span><span>Manage</span>
    </button>
  </nav>
  <div class="sidebar-footer">
    <a href="/" class="nav-item"><span aria-hidden="true" class="material-symbols-outlined">${ICON.home}</span><span>View gallery</span></a>
  </div>
</aside>
<div class="sidebar-scrim" id="${ID.sidebarScrim}"></div>

<header class="top-bar">
  ${themeToggleButton({ dark: ICON.dark_mode, light: ICON.light_mode })}
</header>

<main class="main-content">
  <section id="${ID.tabUpload}">
    <header class="section-header">
      <div class="breadcrumbs">Dashboard / Upload</div>
      <h2>Upload</h2><div class="header-line"></div>
    </header>
    <div id="${ID.dropArea}" class="drop-zone">
      <div class="drop-zone-hl"></div>
      <span aria-hidden="true" class="material-symbols-outlined drop-icon">${ICON.cloud_upload}</span>
      <h3>Drag photos here</h3><p>${UPLOAD_FORMAT_LABEL}</p>
      <button type="button" class="btn-ghost">Choose files</button>
      <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div><div class="corner corner-br"></div>
      <input id="${ID.filePicker}" type="file" accept="${UPLOAD_ACCEPT_ATTRIBUTE}" multiple style="display:none" />
    </div>
    <div class="queue-header">
      <h3>Pending queue (<span id="${ID.queueCount}">0</span>)</h3>
      <div class="queue-actions-bar">
        <button id="${ID.clearQueue}" type="button" class="btn-ghost">Clear all</button>
      </div>
    </div>
    <div id="${ID.uploadProgress}" class="upload-progress" style="display:none">
      <div class="upload-progress-header">
        <span class="upload-progress-label" id="${ID.uploadLabel}">Uploading</span>
        <span class="upload-progress-count" id="${ID.uploadCount}"></span>
      </div>
      <div class="upload-progress-track"><div class="upload-progress-fill" id="${ID.uploadFill}"></div></div>
    </div>
    <p class="upload-progress-status" id="${ID.uploadStatus}" role="status"></p>
    <div id="${ID.queueList}" class="queue-list"></div>
    <div class="upload-footer">
      <button id="${ID.startUpload}" type="button" class="btn-primary-lg">${LABEL.upload}</button>
    </div>
  </section>

  <section id="${ID.tabManage}" hidden>
    <header class="section-header">
      <div class="breadcrumbs">Dashboard / Manage</div><h2>Manage</h2>
      <div class="header-line"></div>
    </header>
    <div class="stats-grid">
      <div class="stat-card stat-card-alt"><p class="stat-label">Total photos</p><p class="stat-value" id="${ID.statTotal}">&mdash;</p></div>
      <div class="stat-card"><p class="stat-label">Storage used</p><p class="stat-value" id="${ID.statStorage}">&mdash;</p></div>
      <div class="stat-card stat-card-alt"><p class="stat-label">Latest upload</p><p class="stat-value" id="${ID.statLatest}">&mdash;</p></div>
      <div class="stat-card"><p class="stat-label">Average size</p><p class="stat-value" id="${ID.statAvgSize}">&mdash;</p></div>
    </div>
    <p id="${ID.statsError}" class="error-text stats-error" role="status"></p>
    <div class="manage-toolbar">
      <label class="search-box"><span aria-hidden="true" class="material-symbols-outlined">${ICON.search}</span><input id="${ID.searchInput}" type="text" aria-label="Search archive" placeholder="Search archive…" /></label>
      <div class="toolbar-actions">
        <span id="${ID.manageError}" class="error-text" role="status"></span>
        <button id="${ID.backfillPlaceholders}" class="btn-ghost" type="button">${LABEL.backfill}</button>
      </div>
    </div>
    <div class="manage-table-wrap">
      <table class="manage-table">
        <thead><tr>
          ${MANAGE_COLUMNS.join('')}
        </tr></thead>
        <tbody id="${ID.manageBody}"></tbody>
      </table>
    </div>
    <div id="${ID.manageEmpty}" class="empty-state" style="display:none"></div>
    <footer class="manage-footer">
      <span id="${ID.pageInfo}" class="page-info"></span>
      <div class="manage-footer-nav">
        <button id="${ID.prevPage}" class="btn-ghost" type="button">Previous</button>
        <button id="${ID.nextPage}" class="btn-ghost" type="button">Next</button>
      </div>
    </footer>
  </section>
</main>`;
}
