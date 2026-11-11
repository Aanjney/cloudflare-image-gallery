import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_LABEL } from '../domain/uploadPolicy';

export function buildAdminUploadScript(): string {
  const allowedUploadTypes = JSON.stringify(ALLOWED_UPLOAD_MIME_TYPES);
  const maxUploadLabel = JSON.stringify(MAX_UPLOAD_LABEL);

  return `  /* ── Upload ── */
  var queueList = byId('queueList');
  var dropArea = byId('dropArea');
  var filePicker = byId('filePicker');
  var clearQueueBtn = byId('clearQueue');
  var startUploadBtn = byId('startUpload');
  var queueCountEl = byId('queueCount');
  var uploadStatus = byId('uploadStatus');
  var queue = [];
  var uploading = false;
  var queueGeneration = 0;
  var isError = function(item){ return item.status === 'Error'; };
  var thumbUrl = function(id){ return imageUrl(id, ADMIN_THUMB_VARIANT); };
  var originalUrl = function(id){ return '/media/' + id; };
  var isPending = function(item){ return item.status === 'Queued' || item.status === 'Uploading'; };
  var revokePreview = function(item){ if (item.preview) URL.revokeObjectURL(item.preview); };
  var newUploadId = function(){
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var hex = '';
    for (var i = 0; i < 16; i++) {
      hex += (b[i] + 256).toString(16).slice(1);
      if (i === 3 || i === 5 || i === 7 || i === 9) hex += '-';
    }
    return hex;
  };

  var queueEmpty = document.createElement('div');
  queueEmpty.className = 'empty-state';
  queueEmpty.textContent = 'No photos queued yet. Drag photos above or choose files.';

  var buildQueueRow = function(item){
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
    var mkField = function(label, field, placeholder) {
      var g = document.createElement('label');
      g.className = 'field-group';
      var l = document.createElement('span');
      l.textContent = label;
      g.appendChild(l);
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = placeholder || '';
      inp.value = item[field] || '';
      inp.setAttribute('data-field', field);
      inp.addEventListener('input', function(){ item[field] = inp.value; });
      g.appendChild(inp);
      return g;
    };
    grid.appendChild(mkField('Camera body', 'cameraBody', 'e.g. Leica M6'));
    grid.appendChild(mkField('Film stock', 'filmStock', 'e.g. Kodak Portra 400'));
    grid.appendChild(mkField('Location', 'location', 'e.g. Faroe Islands'));
    grid.appendChild(mkField('Year', 'year', 'e.g. 2024'));
    fieldsWrap.appendChild(grid);
    var actions = document.createElement('div');
    actions.className = 'queue-item-actions';
    var badge = document.createElement('span');
    badge.className = 'status-badge';
    actions.appendChild(badge);
    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn-danger-text';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">delete</span> Remove';
    removeBtn.addEventListener('click', function(){
      queue = queue.filter(function(q){ return q !== item; });
      revokePreview(item);
      if (uploading) updateProgress();
      renderQueue();
    });
    actions.appendChild(removeBtn);
    fieldsWrap.appendChild(actions);
    row.appendChild(fieldsWrap);
    return row;
  };

  var updateQueueRow = function(item){
    var row = item.row;
    /* buildUploadForm reads the fields when the upload starts, and Done rows leave at the end of the run. */
    var locked = item.status === 'Uploading' || item.status === 'Done';
    row.querySelectorAll('input').forEach(function(inp){ inp.readOnly = locked; });
    var badge = row.querySelector('.status-badge');
    var shown = !!item.status && item.status !== 'Queued';
    badge.hidden = !shown;
    badge.className = 'status-badge' + (item.status === 'Done' ? ' done' : '') + (isError(item) ? ' error' : '');
    badge.textContent = shown ? item.status : '';
    badge.title = item.message || '';
    row.querySelector('.btn-danger-text').hidden = item.status === 'Uploading';
    var oldErr = row.querySelector('.error-text');
    if (oldErr) oldErr.remove();
    if (item.message && isError(item)) {
      var errText = document.createElement('div');
      errText.className = 'error-text';
      errText.textContent = item.message;
      row.querySelector('.queue-item-fields').appendChild(errText);
    }
  };

  /* renderQueue patches existing rows instead of rebuilding them, so focus and the caret survive status changes. */
  var renderQueue = function(){
    queueCountEl.textContent = String(queue.length);
    startUploadBtn.disabled = uploading || !queue.length;
    queueList.querySelectorAll('.queue-item').forEach(function(row){
      if (!queue.some(function(q){ return q.row === row; })) row.remove();
    });
    queueEmpty.remove();
    if (!queue.length) queueList.appendChild(queueEmpty);
    queue.forEach(function(item){
      if (!item.row) queueList.appendChild(item.row = buildQueueRow(item));
      updateQueueRow(item);
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
      uploadStatus.textContent = 'Skipped ' + rejected.join(', ') + '. Only ' + UPLOAD_FORMAT_LABEL + ' files can be uploaded.';
    }
    var generation = queueGeneration;
    Promise.all(valid.map(function(f){return getImageMeta(f);})).then(function(metas){
      if (generation !== queueGeneration) return;
      metas.forEach(function(meta,i){
        queue.push({
          file:valid[i], uploadId:newUploadId(), cameraBody:'', filmStock:'', location:'', year:'',
          width:meta.width, height:meta.height, preview:meta.preview,
          placeholder:meta.placeholder, status:'Queued'
        });
      });
      if (uploading) updateProgress();
      renderQueue();
    });
  };

  dropArea.addEventListener('click', function(){ filePicker.click(); });
  dropArea.addEventListener('dragover', function(e){ e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', function(){ dropArea.classList.remove('dragover'); });
  dropArea.addEventListener('drop', function(e){ e.preventDefault(); dropArea.classList.remove('dragover'); if (e.dataTransfer&&e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  filePicker.addEventListener('change', function(){ if (filePicker.files&&filePicker.files.length) addFiles(filePicker.files); });
  clearQueueBtn.addEventListener('click', function(){
    queueGeneration++;
    queue = queue.filter(function(q){
      if (q.status === 'Uploading') return true;
      revokePreview(q);
      return false;
    });
    if (uploading) updateProgress();
    else { uploadStatus.textContent=''; uploadProgress.style.display='none'; uploadFill.style.transform='scaleX(0)'; }
    renderQueue();
  });

  var uploadProgress = byId('uploadProgress');
  var uploadLabel = byId('uploadLabel');
  var uploadCount = byId('uploadCount');
  var uploadFill = byId('uploadFill');
  var uploadDone = 0;
  var uploadErrors = 0;
  var uploadFraction = 0;
  var MAX_UPLOAD_LABEL = ${maxUploadLabel};
  var RETRY_HINT = ' Select Upload to archive to try again.';
  var UPLOAD_ATTEMPTS = 3;
  var UPLOAD_STALL_MS = 30000;
  var UPLOAD_RESPONSE_MS = 60000;
  var uploadErrorMessage = function(status, data){
    if (status === 409) return data.error || 'The archive is full.';
    if (status === 413) return 'This photo is over ' + MAX_UPLOAD_LABEL + '. Resize it, then add it again.';
    if (status === 400) return 'This file isn’t a supported photo. Use ' + UPLOAD_FORMAT_LABEL + '.';
    return 'The upload didn’t finish.' + RETRY_HINT;
  };

  var updateProgress = function() {
    var total = uploadDone + queue.filter(isPending).length;
    var current = queue.filter(function(q){ return q.status === 'Uploading'; })[0];
    uploadProgress.style.display = 'block';
    uploadFill.style.transform = 'scaleX(' + (total > 0 ? (uploadDone + uploadFraction) / total : 0) + ')';
    uploadCount.textContent = uploadDone + ' / ' + total;
    uploadLabel.textContent = 'Uploading';
    uploadStatus.className = 'upload-progress-status';
    uploadStatus.textContent = current ? current.file.name : '';
  };
  var setUploadFraction = function(fraction){ uploadFraction = fraction; updateProgress(); };

  var buildUploadForm = function(item){
    var fd = new FormData();
    fd.append('file', item.file);
    fd.append('name', item.file.name);
    fd.append('uploadId', item.uploadId);
    fd.append('alt', altFromMeta(item, item.file.name));
    if (item.width) fd.append('width', String(item.width));
    if (item.height) fd.append('height', String(item.height));
    if (item.placeholder) fd.append('placeholder', item.placeholder);
    if (item.cameraBody) fd.append('cameraBody', item.cameraBody.toUpperCase());
    if (item.filmStock) fd.append('filmStock', item.filmStock.toUpperCase());
    if (item.location) fd.append('location', item.location.toUpperCase());
    if (item.year) fd.append('year', item.year.toUpperCase());
    return fd;
  };

  /* XHR rather than fetch: only XHR reports upload progress, which the stall timer needs. */
  var sendUploadOnce = function(item){
    return new Promise(function(resolve, reject){
      var xhr = new XMLHttpRequest();
      var timer = null;
      var watch = function(ms){
        clearTimeout(timer);
        timer = setTimeout(function(){ xhr.abort(); reject(new Error('Upload stalled')); }, ms);
      };
      xhr.open('POST', ADMIN + '/api/upload');
      xhr.upload.onprogress = function(e){
        if (e.lengthComputable && e.total) setUploadFraction(e.loaded / e.total);
        watch(UPLOAD_STALL_MS);
      };
      xhr.upload.onload = function(){ setUploadFraction(1); watch(UPLOAD_RESPONSE_MS); };
      xhr.onload = function(){
        clearTimeout(timer);
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        resolve({ status: xhr.status, data: data || {} });
      };
      xhr.onerror = function(){ clearTimeout(timer); reject(new Error('Network error')); };
      setUploadFraction(0);
      watch(UPLOAD_STALL_MS);
      xhr.send(buildUploadForm(item));
    });
  };

  /* Safe to retry because the server returns the existing photo for a repeated uploadId. */
  var sendUpload = function(item){
    var attempt = function(n){
      var retry = function(result, isFailure){
        if (n + 1 >= UPLOAD_ATTEMPTS) return isFailure ? Promise.reject(result) : result;
        var delay = Math.random() * Math.min(8000, 1000 * Math.pow(2, n));
        return new Promise(function(r){ setTimeout(r, delay); }).then(function(){ return attempt(n + 1); });
      };
      return sendUploadOnce(item).then(function(res){
        return res.status >= 500 ? retry(res, false) : res;
      }, function(err){ return retry(err, true); });
    };
    return attempt(0);
  };

  var failUpload = function(item, message){
    item.status = 'Error';
    item.message = message;
    uploadErrors++;
  };

  var finishRun = function(){
    uploading = false;
    uploadLabel.textContent = uploadErrors ? 'Completed with errors' : 'Complete';
    uploadStatus.className = 'upload-progress-status ' + (uploadErrors ? 'error' : 'done');
    uploadStatus.textContent = uploadErrors
      ? uploadErrors + ' failed, ' + (uploadDone - uploadErrors) + ' uploaded. The failed photos are still in the queue.' + RETRY_HINT
      : uploadDone + ' photo' + (uploadDone !== 1 ? 's' : '') + ' uploaded';
    uploadFill.style.transform = 'scaleX(1)';
    uploadCount.textContent = uploadDone + ' / ' + uploadDone;
    queue = queue.filter(function(q){
      if (q.status !== 'Done') return true;
      revokePreview(q);
      return false;
    });
    renderQueue();
  };

  var uploadNext = function(){
    var item = queue.filter(function(q){ return q.status === 'Queued'; })[0];
    if (!item) { finishRun(); return; }
    item.status = 'Uploading';
    renderQueue();
    sendUpload(item).then(function(res){
      if (res.status >= 200 && res.status < 300 && res.data.ok) {
        item.status = 'Done';
        item.message = (res.data.image && res.data.image.id) || '';
      } else {
        failUpload(item, uploadErrorMessage(res.status, res.data));
      }
    }, function(){
      failUpload(item, 'The connection dropped during upload.' + RETRY_HINT);
    }).then(function(){
      uploadDone++;
      uploadFraction = 0;
      renderQueue();
      uploadNext();
    });
  };

  startUploadBtn.addEventListener('click', function(){
    if (uploading) return;
    queue.forEach(function(q){ if (isError(q)) { q.status = 'Queued'; q.message = ''; } });
    if (!queue.some(function(q){ return q.status === 'Queued'; })) return;
    uploading = true;
    uploadDone = 0;
    uploadErrors = 0;
    uploadNext();
  });`;
}
