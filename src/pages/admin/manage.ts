import { ADMIN_API_PATHS, LIST_LIMITS, PUBLIC_PATHS } from '../../domain/contract';
import { ADMIN_BACKFILL_VARIANT, ADMIN_THUMB_VARIANT } from '../../domain/imageVariants';
import { ICON, ID, LABEL, MANAGE_COLUMNS } from './markup';

/** Defines `initManage()`. Needs ADMIN, FIELDS, cleanField and the shared helpers from the composer. */
export function buildAdminManageScript(): string {
  return `  function initManage() {
    var manageBody = byId('${ID.manageBody}');
    var manageEmpty = byId('${ID.manageEmpty}');
    var prevPageBtn = byId('${ID.prevPage}');
    var nextPageBtn = byId('${ID.nextPage}');
    var pageInfo = byId('${ID.pageInfo}');
    var manageError = byId('${ID.manageError}');
    var searchInput = byId('${ID.searchInput}');
    var backfillBtn = byId('${ID.backfillPlaceholders}');

    var ADMIN_BACKFILL_VARIANT = ${JSON.stringify(ADMIN_BACKFILL_VARIANT)};
    var ADMIN_THUMB_VARIANT = ${JSON.stringify(ADMIN_THUMB_VARIANT)};
    var MUTATION_RETRY = { attempts: 2, timeoutMs: 15000 };
    var READ_RETRY = { attempts: 2, timeoutMs: 10000 };
    var BACKFILL_WORKERS = 3;
    var DELETE_FAILED = 'Couldn’t delete this photo. Check your connection and try again.';
    var SAVE_GONE = 'This photo was deleted, so your changes weren’t saved. Refresh the page to update the list.';
    var SAVE_FAILED = 'Couldn’t save your changes. They’re still in the form. Check your connection and select Save again.';

    var manageItems = [];
    var currentCursor = null;
    var nextCursor = null;
    var prevStack = [];
    var pageSize = 10;
    var editingId = null;
    var editRowEl = null;
    var editRowFor = null;
    var drafts = {};
    var rowsById = {};
    var loadSeq = 0;
    var searchTimer = null;
    var backfillRunning = false;
    var backfillCancelled = false;

    function thumbUrl(id) { return imageUrl(id, ADMIN_THUMB_VARIANT); }
    function originalUrl(id) { return ${JSON.stringify(PUBLIC_PATHS.media)} + id; }

    function postJson(path, body) {
      return fetchWithRetry(ADMIN + path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}, MUTATION_RETRY);
    }

    function fmtDate(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    }

    function flashStatus(text) {
      manageError.textContent = text;
      setTimeout(function(){ if (manageError.textContent === text) manageError.textContent = ''; }, 1200);
    }

    function renderManage() {
      var focused = editRowEl && editRowEl.contains(document.activeElement) ? document.activeElement : null;
      manageBody.innerHTML = '';
      rowsById = {};
      pageInfo.textContent = 'Page ' + (prevStack.length+1) + (nextCursor ? ' \\u2192' : '');
      manageEmpty.style.display = manageItems.length ? 'none' : 'block';
      manageEmpty.textContent = searchInput.value
        ? 'No photos match “' + searchInput.value + '”. Check the spelling or clear the search.'
        : 'No photos yet. Open the Upload tab to add your first photos.';

      manageItems.forEach(function(item){
        var tr = document.createElement('tr');

        var thumbTd = document.createElement('td');
        var thumbDiv = document.createElement('div');
        thumbDiv.className = 'manage-thumb';
        var img = document.createElement('img');
        img.src = thumbUrl(item.id);
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = function(){ img.onerror = null; img.src = originalUrl(item.id); };
        img.alt = item.name || 'Photo';
        thumbDiv.appendChild(img);
        thumbTd.appendChild(thumbDiv);
        tr.appendChild(thumbTd);

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

        var sizeTd = document.createElement('td');
        sizeTd.className = 'manage-meta';
        sizeTd.textContent = item.size ? Math.round(item.size/1024)+' KB' : '';
        tr.appendChild(sizeTd);

        var dateTd = document.createElement('td');
        dateTd.className = 'manage-meta';
        dateTd.textContent = fmtDate(item.createdAt);
        tr.appendChild(dateTd);

        var actionsTd = document.createElement('td');
        actionsTd.className = 'manage-actions';

        var copyBtn = document.createElement('button');
        copyBtn.className = 'btn-icon'; copyBtn.type = 'button'; copyBtn.setAttribute('aria-label', 'Copy link');
        copyBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">${ICON.content_copy}</span>';
        copyBtn.addEventListener('click', function(){
          var link = window.location.origin + originalUrl(item.id);
          navigator.clipboard.writeText(link).then(function(){ flashStatus('Link copied'); })
            .catch(function(){ prompt('Copy link:', link); });
        });
        actionsTd.appendChild(copyBtn);

        var editBtn = document.createElement('button');
        editBtn.className = 'btn-icon'; editBtn.type = 'button'; editBtn.setAttribute('aria-label', 'Edit details');
        editBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">${ICON.edit}</span>';
        editBtn.addEventListener('click', function(){ toggleEditRow(item, tr); });
        actionsTd.appendChild(editBtn);

        var delBtn = document.createElement('button');
        delBtn.className = 'btn-icon danger'; delBtn.type = 'button'; delBtn.setAttribute('aria-label', 'Delete photo');
        delBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">${ICON.delete}</span>';
        delBtn.addEventListener('click', function(){
          if (!confirm('Delete “' + (item.name || 'this photo') + '”? This removes the photo from the gallery and storage. It can’t be undone.')) return;
          delBtn.disabled = true;
          postJson('${ADMIN_API_PATHS.delete}',{id:item.id})
            .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
              /* 404 means it is already gone, for example when a retry follows a lost response. */
              if(r.status!==404&&(!r.ok||!d.ok)){alert(DELETE_FAILED);delBtn.disabled=false;return;}
              manageItems=manageItems.filter(function(x){return x.id!==item.id;});renderManage();
            }); }).catch(function(){alert(DELETE_FAILED);delBtn.disabled=false;});
        });
        actionsTd.appendChild(delBtn);
        tr.appendChild(actionsTd);
        manageBody.appendChild(tr);
        rowsById[item.id] = tr;
      });

      var anchor = editingId && rowsById[editingId];
      if (!anchor) { closeEditRow(); return; }
      if (editRowEl && editRowFor === editingId) {
        anchor.after(editRowEl);
        if (focused) focused.focus();
      } else {
        buildEditRow(itemById(editingId), anchor);
      }
    }

    function itemById(id) {
      for (var i=0;i<manageItems.length;i++){ if (manageItems[i].id===id) return manageItems[i]; }
      return null;
    }

    function dropDraft(id) { if (drafts[id] && !drafts[id].saving) delete drafts[id]; }
    function closeEditRow() {
      if (editRowEl) editRowEl.remove();
      if (editingId) dropDraft(editingId);
      editRowEl = null; editRowFor = null; editingId = null;
    }
    function toggleEditRow(item, row) {
      var wasOpen = editingId === item.id;
      closeEditRow();
      if (wasOpen) return;
      editingId = item.id;
      buildEditRow(item, row);
    }

    function buildEditRow(item, afterRow) {
      if (editRowEl) editRowEl.remove();
      var draft = drafts[item.id];
      if (!draft) {
        draft = drafts[item.id] = { saving: false };
        FIELDS.forEach(function(f){ draft[f.name] = item[f.name] || ''; });
      }

      var editTr = document.createElement('tr');
      editTr.className = 'edit-row';
      var td = document.createElement('td');
      td.colSpan = ${MANAGE_COLUMNS.length};

      var form = document.createElement('div');
      form.className = 'edit-form';
      FIELDS.forEach(function(f){
        var g = document.createElement('label');
        g.className = 'field-group';
        var l = document.createElement('span');
        l.textContent = f.label;
        g.appendChild(l);
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = draft[f.name]; inp.placeholder = f.placeholder; inp.maxLength = f.maxLength;
        inp.addEventListener('input', function(){ draft[f.name] = inp.value; });
        g.appendChild(inp);
        form.appendChild(g);
      });
      td.appendChild(form);

      var acts = document.createElement('div');
      acts.className = 'edit-actions';
      var saveBtn = document.createElement('button');
      saveBtn.className = 'btn-save'; saveBtn.type = 'button';
      saveBtn.disabled = draft.saving;
      saveBtn.textContent = draft.saving ? 'Saving…' : 'Save';
      saveBtn.addEventListener('click', function(){
        saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
        saveEdit(item, draft);
      });
      acts.appendChild(saveBtn);
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-cancel'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', closeEditRow);
      acts.appendChild(cancelBtn);
      td.appendChild(acts);
      editTr.appendChild(td);
      afterRow.after(editTr);
      editRowEl = editTr;
      editRowFor = item.id;
    }

    function saveEdit(item, draft) {
      draft.saving = true;
      var body = {id:item.id};
      FIELDS.forEach(function(f){ body[f.name] = cleanField(draft[f.name]); });
      body.alt = altFromMeta(body, item.name || 'Film photograph');
      function failed(status) {
        draft.saving = false;
        if (editingId === item.id && rowsById[item.id]) buildEditRow(item, rowsById[item.id]);
        alert(status === 404 ? SAVE_GONE : SAVE_FAILED);
      }
      postJson('${ADMIN_API_PATHS.update}', body)
        .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
          if (!r.ok||!d.ok||!d.image){ failed(r.status); return; }
          delete drafts[item.id];
          for (var i=0;i<manageItems.length;i++){
            if (manageItems[i].id===item.id){ manageItems[i]=d.image; break; }
          }
          if (editingId === item.id) closeEditRow();
          renderManage();
          flashStatus('Changes saved');
        }); }).catch(function(){ failed(0); });
    }

    function loadAllManage() {
      var all = [], failure = null;
      return forEachImagePage('${PUBLIC_PATHS.images}?limit=${LIST_LIMITS.maxPageSize}', function(items){ all = all.concat(items); }, function(err){ failure = err; }, {cache:'no-store'})
        .then(function(){ if (failure) throw failure; return all; });
    }

    function loadBucketStats() {
      fetchWithRetry(ADMIN + '${ADMIN_API_PATHS.stats}', undefined, READ_RETRY).then(function(r){
        if (!r.ok) throw new Error('stats failed');
        return r.json();
      }).then(function(s){
        if (!s || typeof s.total !== 'number') throw new Error('stats malformed');
        byId('${ID.statTotal}').textContent = String(s.total);
        byId('${ID.statStorage}').textContent = (s.totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (s.latestCreatedAt) byId('${ID.statLatest}').textContent = fmtDate(s.latestCreatedAt);
        byId('${ID.statAvgSize}').textContent = s.total ? Math.round(s.avgSize / 1024) + ' KB' : '\\u2014';
      }).catch(function(){
        byId('${ID.statsError}').textContent = 'Couldn’t load the archive stats. Refresh the page to try again.';
      });
    }

    function loadManagePage(cursorParam) {
      var seq = ++loadSeq;
      prevPageBtn.disabled=true; nextPageBtn.disabled=true;
      manageBody.innerHTML='<tr><td colspan="${MANAGE_COLUMNS.length}" class="manage-meta" style="padding:2rem;text-align:center">Loading…</td></tr>';
      var qsP = new URLSearchParams();
      qsP.set('limit',String(pageSize));
      if (cursorParam) qsP.set('cursor',cursorParam);
      if (searchInput.value) qsP.set('q',searchInput.value);
      function showLoadError(msg) { manageBody.innerHTML=''; manageEmpty.style.display='none'; manageError.textContent=msg; }
      fetchWithRetry('${PUBLIC_PATHS.images}?'+qsP.toString(), {cache:'no-store'}, READ_RETRY).then(function(resp){
        if (seq !== loadSeq) return;
        if (!resp.ok) throw new Error('load failed');
        return resp.json().then(function(data){
          if (seq !== loadSeq) return;
          manageItems=data.items||[]; currentCursor=cursorParam||null; nextCursor=data.cursor||null;
          prevPageBtn.disabled=prevStack.length===0; nextPageBtn.disabled=!nextCursor;
          manageError.textContent=''; renderManage();
        });
      }).catch(function(){ if (seq === loadSeq) showLoadError('Couldn’t load photos. Check your connection, then refresh the page.'); });
    }

    function resetBackfillButton() {
      backfillRunning = false;
      backfillBtn.disabled = false;
      backfillBtn.textContent = '${LABEL.backfill}';
      manageError.textContent = '';
    }
    function decodeColor(blob) {
      return new Promise(function(resolve, reject){
        var url = URL.createObjectURL(blob), img = new Image();
        img.onload = function(){ var color = placeholderFromImage(img); URL.revokeObjectURL(url); resolve(color); };
        img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode failed')); };
        img.src = url;
      });
    }
    function backfillOne(item) {
      return fetchWithRetry(imageUrl(item.id, ADMIN_BACKFILL_VARIANT), undefined, MUTATION_RETRY)
        .then(function(r){ if (!r.ok) throw new Error('thumbnail failed'); return r.blob(); })
        .then(decodeColor)
        .then(function(color){ return postJson('${ADMIN_API_PATHS.update}', {id:item.id, placeholder:color}); })
        .then(function(r){ return r.ok; }, function(){ return false; });
    }

    searchInput.addEventListener('input',function(){
      if(searchTimer)clearTimeout(searchTimer);
      searchTimer=setTimeout(function(){ prevStack.length=0; loadManagePage(null); },200);
    });
    prevPageBtn.addEventListener('click',function(){ if(!prevStack.length)return; loadManagePage(prevStack.pop()||null); });
    nextPageBtn.addEventListener('click',function(){ if(!nextCursor)return; prevStack.push(currentCursor); loadManagePage(nextCursor); });

    backfillBtn.addEventListener('click',function(){
      if (backfillRunning) {
        backfillCancelled = true;
        backfillBtn.disabled = true;
        backfillBtn.textContent = 'Cancelling…';
        return;
      }
      backfillRunning = true; backfillCancelled = false;
      backfillBtn.disabled=true;backfillBtn.textContent='Working…';
      loadAllManage().then(function(all){
        var todo = all.filter(function(item){ return !item.placeholder; });
        var nextIndex = 0, updated = 0, processed = 0;
        backfillBtn.textContent='Cancel';backfillBtn.disabled=false;
        function worker() {
          if (backfillCancelled || nextIndex >= todo.length) return Promise.resolve();
          var item = todo[nextIndex++];
          return backfillOne(item).then(function(ok){
            if (ok) updated++;
            processed++;
            manageError.textContent = 'Processed ' + processed + '/' + todo.length;
            return worker();
          });
        }
        var workers = [];
        for (var w = 0; w < BACKFILL_WORKERS; w++) workers.push(worker());
        return Promise.all(workers).then(function(){
          var cancelled = backfillCancelled;
          resetBackfillButton();
          alert(cancelled
            ? 'Stopped. Added colors to ' + updated + ' of ' + todo.length + ' photos.'
            : 'Added placeholder colors to ' + updated + ' photo' + (updated !== 1 ? 's' : '') + '.');
        });
      }, function(){
        resetBackfillButton();
        alert('Couldn’t load the photo list, so no colors were added. Check your connection and select ${LABEL.backfill} again.');
      });
    });

    loadManagePage(null);
    loadBucketStats();
  }`;
}
