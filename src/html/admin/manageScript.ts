export function buildAdminManageScript(): string {
  return `  /* ── Manage ── */
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
  });`;
}
