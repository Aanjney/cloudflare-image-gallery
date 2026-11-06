export function buildAdminManageScript(): string {
  return `  /* ── Manage ── */
  var manageBody = byId('manageBody');
  var manageEmpty = byId('manageEmpty');
  var prevPageBtn = byId('prevPage');
  var nextPageBtn = byId('nextPage');
  var pageInfo = byId('pageInfo');
  var manageError = byId('manageError');
  var searchInput = byId('searchInput');
  var backfillBtn = byId('backfillPlaceholders');
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
  var MUTATION_RETRY = { attempts: 2, timeoutMs: 15000 };
  var READ_RETRY = { attempts: 2, timeoutMs: 10000 };
  var postJson = function(path, body){
    return fetchWithRetry(ADMIN + path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}, MUTATION_RETRY);
  };
  var DELETE_FAILED = 'Couldn\u2019t delete this photo. Check your connection and try again.';
  var SAVE_GONE = 'This photo was deleted, so your changes weren’t saved. Refresh the page to update the list.';
  var SAVE_FAILED = 'Couldn\u2019t save your changes. They\u2019re still in the form. Check your connection and select Save again.';

  var fmtDate = function(iso){
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };

  var renderManage = function(){
    var focused = editRowEl && editRowEl.contains(document.activeElement) ? document.activeElement : null;
    manageBody.innerHTML = '';
    rowsById = {};
    if (pageInfo){ pageInfo.textContent = 'Page ' + (prevStack.length+1) + (nextCursor ? ' \\u2192' : ''); }
    manageEmpty.style.display = manageItems.length ? 'none' : 'block';
    manageEmpty.textContent = searchInput.value
      ? 'No photos match \u201c' + searchInput.value + '\u201d. Check the spelling or clear the search.'
      : 'No photos yet. Open the Upload tab to add your first photos.';

    manageItems.forEach(function(item){
      var tr = document.createElement('tr');

      /* Thumb */
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
      copyBtn.className = 'btn-icon'; copyBtn.type = 'button'; copyBtn.setAttribute('aria-label', 'Copy link');
      copyBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">content_copy</span>';
      (function(iid){ copyBtn.addEventListener('click', function(){
        navigator.clipboard.writeText(window.location.origin+'/media/'+iid).then(function(){
          manageError.textContent='Link copied';
          setTimeout(function(){if(manageError.textContent==='Link copied')manageError.textContent='';},1200);
        }).catch(function(){prompt('Copy link:',window.location.origin+'/media/'+iid);});
      }); })(item.id);
      actionsTd.appendChild(copyBtn);

      var editBtn = document.createElement('button');
      editBtn.className = 'btn-icon'; editBtn.type = 'button'; editBtn.setAttribute('aria-label', 'Edit details');
      editBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">edit</span>';
      (function(itm, rowEl){
        editBtn.addEventListener('click', function(){ toggleEditRow(itm, rowEl); });
      })(item, tr);
      actionsTd.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger'; delBtn.type = 'button'; delBtn.setAttribute('aria-label', 'Delete photo');
      delBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">delete</span>';
      (function(iid, label){
        delBtn.addEventListener('click', function(){
          if (!confirm('Delete \u201c' + label + '\u201d? This removes the photo from the gallery and storage. It can\u2019t be undone.')) return;
          delBtn.disabled = true;
          postJson('/api/images/delete',{id:iid})
            .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
              /* 404 means it is already gone, for example when a retry follows a lost response. */
              if(r.status!==404&&(!r.ok||!d.ok)){alert(DELETE_FAILED);delBtn.disabled=false;return;}
              manageItems=manageItems.filter(function(x){return x.id!==iid;});renderManage();
            }); }).catch(function(){alert(DELETE_FAILED);delBtn.disabled=false;});
        });
      })(item.id, item.name || 'this photo');
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
  };

  var itemById = function(id){
    for (var i=0;i<manageItems.length;i++){ if (manageItems[i].id===id) return manageItems[i]; }
    return null;
  };

  /* ── Inline edit row ── */
  var EDIT_FIELDS = [
    {label:'Camera body',field:'cameraBody',ph:'e.g. Leica M6'},
    {label:'Film stock',field:'filmStock',ph:'e.g. Kodak Portra 400'},
    {label:'Location',field:'location',ph:'e.g. Faroe Islands'},
    {label:'Year',field:'year',ph:'e.g. 2024'}
  ];
  var dropDraft = function(id){ if (drafts[id] && !drafts[id].saving) delete drafts[id]; };
  var closeEditRow = function(){
    if (editRowEl) editRowEl.remove();
    if (editingId) dropDraft(editingId);
    editRowEl = null; editRowFor = null; editingId = null;
  };
  var toggleEditRow = function(item, row){
    var wasOpen = editingId === item.id;
    closeEditRow();
    if (wasOpen) return;
    editingId = item.id;
    buildEditRow(item, row);
  };

  var buildEditRow = function(item, afterRow){
    if (editRowEl) editRowEl.remove();
    var draft = drafts[item.id];
    if (!draft) {
      draft = drafts[item.id] = { saving: false };
      EDIT_FIELDS.forEach(function(f){ draft[f.field] = item[f.field] || ''; });
    }

    var editTr = document.createElement('tr');
    editTr.className = 'edit-row';
    var td = document.createElement('td');
    td.colSpan = 5;

    var form = document.createElement('div');
    form.className = 'edit-form';
    EDIT_FIELDS.forEach(function(f){
      var g = document.createElement('label');
      g.className = 'field-group';
      var l = document.createElement('span');
      l.textContent = f.label;
      g.appendChild(l);
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = draft[f.field]; inp.placeholder = f.ph;
      inp.addEventListener('input', function(){ draft[f.field] = inp.value; });
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
      saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026';
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
  };

  var saveEdit = function(item, draft){
    draft.saving = true;
    var body = {id:item.id};
    EDIT_FIELDS.forEach(function(f){ body[f.field] = draft[f.field].trim().toUpperCase(); });
    body.alt = altFromMeta(body, item.name || 'Film photograph');
    var failed = function(status){
      draft.saving = false;
      if (editingId === item.id && rowsById[item.id]) buildEditRow(item, rowsById[item.id]);
      alert(status === 404 ? SAVE_GONE : SAVE_FAILED);
    };
    postJson('/api/images/update', body)
      .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){
        if (!r.ok||!d.ok||!d.image){ failed(r.status); return; }
        delete drafts[item.id];
        for (var i=0;i<manageItems.length;i++){
          if (manageItems[i].id===item.id){ manageItems[i]=d.image; break; }
        }
        if (editingId === item.id) closeEditRow();
        renderManage();
        manageError.textContent = 'Changes saved'; setTimeout(function(){if(manageError.textContent==='Changes saved')manageError.textContent='';},1200);
      }); }).catch(function(){ failed(0); });
  };

  var loadAllManage = function(){
    var all = [], failure = null;
    return forEachImagePage('/api/images?limit=500', function(items){ all = all.concat(items); }, function(err){ failure = err; }, {cache:'no-store'})
      .then(function(){ if (failure) throw failure; return all; });
  };

  var loadBucketStats = function(){
    fetchWithRetry(ADMIN + '/api/stats', undefined, READ_RETRY).then(function(r){ return r.json(); }).then(function(s){
      if (!s || typeof s.total !== 'number') return;
      byId('statTotal').textContent = String(s.total);
      byId('statStorage').textContent = (s.totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
      if (s.latestCreatedAt) byId('statLatest').textContent = fmtDate(s.latestCreatedAt);
      byId('statAvgSize').textContent = s.total ? Math.round(s.avgSize / 1024) + ' KB' : '\\u2014';
    }).catch(function(){});
  };

  var loadManagePage = function(cursorParam){
    var seq = ++loadSeq;
    prevPageBtn.disabled=true; nextPageBtn.disabled=true;
    manageBody.innerHTML='<tr><td colspan="5" class="manage-meta" style="padding:2rem;text-align:center">Loading…</td></tr>';
    var qsP = new URLSearchParams();
    qsP.set('limit',String(pageSize));
    if (cursorParam) qsP.set('cursor',cursorParam);
    if (searchInput.value) qsP.set('q',searchInput.value);
    var showLoadError = function(msg){ manageBody.innerHTML=''; manageEmpty.style.display='none'; manageError.textContent=msg; };
    fetchWithRetry('/api/images?'+qsP.toString(), {cache:'no-store'}, READ_RETRY).then(function(resp){
      if (seq !== loadSeq) return;
      if (resp.status===401){showLoadError('Your sign-in has expired. Refresh the page to sign in again.');return;}
      if (!resp.ok) throw new Error('load failed');
      return resp.json().then(function(data){
        if (seq !== loadSeq) return;
        manageItems=data.items||[]; currentCursor=cursorParam||null; nextCursor=data.cursor||null;
        prevPageBtn.disabled=prevStack.length===0; nextPageBtn.disabled=!nextCursor;
        manageError.textContent=''; renderManage();
      });
    }).catch(function(){ if (seq === loadSeq) showLoadError('Couldn’t load photos. Check your connection, then refresh the page.'); });
  };

  var searchTimer=null;
  searchInput.addEventListener('input',function(){
    if(searchTimer)clearTimeout(searchTimer);
    searchTimer=setTimeout(function(){ prevStack.length=0; loadManagePage(null); },200);
  });
  prevPageBtn.addEventListener('click',function(){ if(!prevStack.length)return; loadManagePage(prevStack.pop()||null); });
  nextPageBtn.addEventListener('click',function(){ if(!nextCursor)return; prevStack.push(currentCursor); loadManagePage(nextCursor); });

  /* ── Backfill ── */
  var BACKFILL_WORKERS = 3;
  var backfillRunning = false;
  var backfillCancelled = false;
  var resetBackfillButton = function(){
    backfillRunning = false;
    backfillBtn.disabled = false;
    backfillBtn.textContent = 'Backfill colors';
    manageError.textContent = '';
  };
  var decodeColor = function(blob){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function(){ var color = placeholderFromImage(img); URL.revokeObjectURL(url); resolve(color); };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  };
  var backfillOne = function(item){
    return fetchWithRetry(imageUrl(item.id, ADMIN_BACKFILL_VARIANT), undefined, MUTATION_RETRY)
      .then(function(r){ if (!r.ok) throw new Error('thumbnail failed'); return r.blob(); })
      .then(decodeColor)
      .then(function(color){ return postJson('/api/images/update', {id:item.id, placeholder:color}); })
      .then(function(r){ return r.ok; }, function(){ return false; });
  };
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
      var worker = function(){
        if (backfillCancelled || nextIndex >= todo.length) return Promise.resolve();
        var item = todo[nextIndex++];
        return backfillOne(item).then(function(ok){
          if (ok) updated++;
          processed++;
          manageError.textContent = 'Processed ' + processed + '/' + todo.length;
          return worker();
        });
      };
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
      alert('Couldn’t load the photo list, so no colors were added. Check your connection and select Backfill colors again.');
    });
  });`;
}
