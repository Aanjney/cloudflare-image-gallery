import { ALLOWED_UPLOAD_MIME_TYPES } from '../domain/uploadPolicy';

export function buildAdminUploadScript(): string {
  const allowedUploadTypes = JSON.stringify(ALLOWED_UPLOAD_MIME_TYPES);

  return `  /* ── Upload ── */
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
        resolve({
          width: img.naturalWidth || '',
          height: img.naturalHeight || '',
          preview: url,
          placeholder: placeholderFromImage(img),
        });
      };
      img.onerror = function(){
        resolve({ width: '', height: '', preview: url, placeholder: PLACEHOLDER_DEFAULT });
      };
      img.src = url;
    });
  };

  var ALLOWED_UPLOAD_TYPES = ${allowedUploadTypes};
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
      uploadStatus.textContent = 'Unsupported format (only ' + UPLOAD_FORMAT_LABEL + '): ' + rejected.join(', ');
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
  });`;
}
