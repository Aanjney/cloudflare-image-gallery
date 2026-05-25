import {
  ADMIN_BACKFILL_VARIANT,
  ADMIN_THUMB_VARIANT,
} from '../../imageVariants';

export function buildAdminScript(adminPrefix: string): string {
  const adminThumbVariant = JSON.stringify(ADMIN_THUMB_VARIANT);
  const adminBackfillVariant = JSON.stringify(ADMIN_BACKFILL_VARIANT);

  return `<script>
(function(){
  var ADMIN = '${adminPrefix}';
  var qs = function(id){ return document.getElementById(id); };
  var ADMIN_THUMB_VARIANT = ${adminThumbVariant};
  var ADMIN_BACKFILL_VARIANT = ${adminBackfillVariant};
  var imageUrl = function(id, variant){ return '/img/' + id + '?w=' + variant.width + '&q=' + variant.quality + '&fmt=' + variant.format; };

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
  var thumbUrl = function(id){ return imageUrl(id, ADMIN_THUMB_VARIANT); };
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

  var ALLOWED_UPLOAD_TYPES = ['image/jpeg','image/png','image/webp'];
  var addFiles = function(files){
    var arr = Array.from(files), valid = [], rejected = [];
    for (var i=0;i<arr.length;i++){
      if (ALLOWED_UPLOAD_TYPES.indexOf(arr[i].type) === -1){ rejected.push(arr[i].name); continue; }
      valid.push(arr[i]);
    }
    if (rejected.length){
      uploadProgress.style.display = 'block';
      uploadLabel.textContent = 'Skipped';
      uploadStatus.className = 'upload-progress-status error';
      uploadStatus.textContent = 'Unsupported format (only JPEG, PNG, WebP): ' + rejected.join(', ');
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
    for (var i=0;i<queue.length;i++){ if (queue[i].status==='Queued'){idx=i;break;} }
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
        fetch(imageUrl(all[i].id, ADMIN_BACKFILL_VARIANT)).then(function(r){return r.blob();}).then(function(blob){
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
</script>`;
}
