import { ADMIN_API_PATHS } from '../../domain/contract';
import { PLACEHOLDER_DEFAULT } from '../../domain/placeholderColor';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_LABEL,
  UPLOAD_FORMAT_LABEL,
} from '../../domain/uploadPolicy';
import { ICON, ID, LABEL } from './markup';

/** Defines `initUpload()`. Needs ADMIN, FIELDS, cleanField and the shared helpers from the composer. */
export function buildAdminUploadScript(): string {
  return `  function initUpload() {
    var queueList = byId('${ID.queueList}');
    var dropArea = byId('${ID.dropArea}');
    var filePicker = byId('${ID.filePicker}');
    var clearQueueBtn = byId('${ID.clearQueue}');
    var startUploadBtn = byId('${ID.startUpload}');
    var queueCountEl = byId('${ID.queueCount}');
    var uploadStatus = byId('${ID.uploadStatus}');
    var uploadProgress = byId('${ID.uploadProgress}');
    var uploadLabel = byId('${ID.uploadLabel}');
    var uploadCount = byId('${ID.uploadCount}');
    var uploadFill = byId('${ID.uploadFill}');

    var ALLOWED_UPLOAD_TYPES = ${JSON.stringify(ALLOWED_UPLOAD_MIME_TYPES)};
    var UPLOAD_FORMAT_LABEL = ${JSON.stringify(UPLOAD_FORMAT_LABEL)};
    var MAX_UPLOAD_LABEL = ${JSON.stringify(MAX_UPLOAD_LABEL)};
    var RETRY_HINT = ' Select ${LABEL.upload} to try again.';
    var UPLOAD_ATTEMPTS = 3;
    var UPLOAD_STALL_MS = 30000;
    var UPLOAD_RESPONSE_MS = 60000;

    var queue = [];
    var uploading = false;
    var queueGeneration = 0;
    var uploadDone = 0;
    var uploadErrors = 0;
    var uploadFraction = 0;

    var queueEmpty = document.createElement('div');
    queueEmpty.className = 'empty-state';
    queueEmpty.textContent = 'No photos queued yet. Drag photos above or choose files.';

    function isError(item) { return item.status === 'Error'; }
    function isPending(item) { return item.status === 'Queued' || item.status === 'Uploading'; }
    function revokePreview(item) { if (item.preview) URL.revokeObjectURL(item.preview); }
    function newUploadId() {
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
    }

    function buildQueueRow(item) {
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
      FIELDS.forEach(function(f) {
        var g = document.createElement('label');
        g.className = 'field-group';
        var l = document.createElement('span');
        l.textContent = f.label;
        g.appendChild(l);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = f.placeholder;
        inp.maxLength = f.maxLength;
        inp.value = item[f.name] || '';
        inp.setAttribute('data-field', f.name);
        inp.addEventListener('input', function(){ item[f.name] = inp.value; });
        g.appendChild(inp);
        grid.appendChild(g);
      });
      fieldsWrap.appendChild(grid);
      var actions = document.createElement('div');
      actions.className = 'queue-item-actions';
      var badge = document.createElement('span');
      badge.className = 'status-badge';
      actions.appendChild(badge);
      var removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger-text';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<span aria-hidden="true" class="material-symbols-outlined">${ICON.delete}</span> Remove';
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
    }

    function updateQueueRow(item) {
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
    }

    /* Patches existing rows instead of rebuilding them, so focus and the caret survive status changes. */
    function renderQueue() {
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
    }

    function getImageMeta(file) {
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
          resolve({ width: '', height: '', preview: url, placeholder: '${PLACEHOLDER_DEFAULT}' });
        };
        img.src = url;
      });
    }

    function addFiles(files) {
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
          var item = {
            file:valid[i], uploadId:newUploadId(),
            width:meta.width, height:meta.height, preview:meta.preview,
            placeholder:meta.placeholder, status:'Queued'
          };
          FIELDS.forEach(function(f){ item[f.name] = ''; });
          queue.push(item);
        });
        if (uploading) updateProgress();
        renderQueue();
      });
    }

    function uploadErrorMessage(status, data) {
      if (status === 409) return data.error || 'The archive is full.';
      if (status === 413) return 'This photo is over ' + MAX_UPLOAD_LABEL + '. Resize it, then add it again.';
      if (status === 400) return data.error || 'This file isn’t a supported photo. Use ' + UPLOAD_FORMAT_LABEL + '.';
      return 'The upload didn’t finish.' + RETRY_HINT;
    }

    function updateProgress() {
      var total = uploadDone + queue.filter(isPending).length;
      var current = queue.filter(function(q){ return q.status === 'Uploading'; })[0];
      uploadProgress.style.display = 'block';
      uploadFill.style.transform = 'scaleX(' + (total > 0 ? (uploadDone + uploadFraction) / total : 0) + ')';
      uploadCount.textContent = uploadDone + ' / ' + total;
      uploadLabel.textContent = 'Uploading';
      uploadStatus.className = 'upload-progress-status';
      uploadStatus.textContent = current ? current.file.name : '';
    }
    function setUploadFraction(fraction) { uploadFraction = fraction; updateProgress(); }

    function buildUploadForm(item) {
      var fd = new FormData();
      fd.append('file', item.file);
      fd.append('name', item.file.name);
      fd.append('uploadId', item.uploadId);
      fd.append('alt', altFromMeta(item, item.file.name));
      if (item.width) fd.append('width', String(item.width));
      if (item.height) fd.append('height', String(item.height));
      if (item.placeholder) fd.append('placeholder', item.placeholder);
      FIELDS.forEach(function(f){
        var v = cleanField(item[f.name]);
        if (v) fd.append(f.name, v);
      });
      return fd;
    }

    /* XHR rather than fetch: only XHR reports upload progress, which the stall timer needs. */
    function sendUploadOnce(item) {
      return new Promise(function(resolve, reject){
        var xhr = new XMLHttpRequest();
        var timer = null;
        function watch(ms) {
          clearTimeout(timer);
          timer = setTimeout(function(){ xhr.abort(); reject(new Error('Upload stalled')); }, ms);
        }
        xhr.open('POST', ADMIN + '${ADMIN_API_PATHS.upload}');
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
    }

    /* Safe to retry because the server returns the existing photo for a repeated uploadId. */
    function sendUpload(item) {
      return retryWithBackoff(
        function(){ return sendUploadOnce(item); },
        function(res){ return res.status >= 500; },
        UPLOAD_ATTEMPTS, 1000, 8000);
    }

    function failUpload(item, message) {
      item.status = 'Error';
      item.message = message;
      uploadErrors++;
    }

    function finishRun() {
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
    }

    function uploadNext() {
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
    }

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
    startUploadBtn.addEventListener('click', function(){
      if (uploading) return;
      queue.forEach(function(q){ if (isError(q)) { q.status = 'Queued'; q.message = ''; } });
      if (!queue.some(function(q){ return q.status === 'Queued'; })) return;
      uploading = true;
      uploadDone = 0;
      uploadErrors = 0;
      uploadNext();
    });

    renderQueue();
  }`;
}
