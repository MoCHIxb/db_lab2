/**
 * files.js  —  文件浏览、上传、详情、分享相关逻辑
 */

let browseState = {
  page: 1,
  per_page: 12,
  keyword: '',
  file_type: '',
  category_id: '',
  tag_id: '',
  sort_by: 'upload_time',
  order: 'desc',
};

let myFilesState = { page: 1, per_page: 10 };
let sharesState = { page: 1, per_page: 10 };
let uploadCategoryTree = [];

const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']);
const VIDEO_EXTS = new Set(['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm']);

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSize(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function visibilityText(v) {
  if (Number(v) === 0) return '私有';
  if (Number(v) === 2) return '授权可见';
  return '公开';
}

function fileIcon(type) {
  return type === 'audio' ? '🎵' : '🎬';
}

function detectMediaTypeByName(filename) {
  const name = String(filename || '').toLowerCase();
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  const ext = name.slice(i + 1);
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return '';
}

function findRootCategoryByName(name) {
  return (uploadCategoryTree || []).find((c) => c && c.category_name === name);
}

function renderUploadCategoryOptionsByType(fileType) {
  const box = document.getElementById('uploadCategories');
  if (!box) return;

  if (!fileType) {
    box.innerHTML = '<label><span>请先选择文件，系统将按音频/视频显示可选子分类。</span></label>';
    return;
  }

  const rootName = fileType === 'audio' ? '音频' : '视频';
  const root = findRootCategoryByName(rootName);
  const children = root && Array.isArray(root.children) ? root.children : [];

  if (!children.length) {
    box.innerHTML = `<label><span>暂无“${escapeHtml(rootName)}”子分类，请先在管理后台新增。</span></label>`;
    return;
  }

  box.innerHTML = children.map((c) => `
    <label>
      <input type="checkbox" value="${c.category_id}" />
      <span>${escapeHtml(c.category_name)}</span>
    </label>
  `).join('');
}

function buildPagination(containerId, page, pages, onChange) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = '';
  if (!pages || pages <= 1) return;

  const createBtn = (label, target, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (active) btn.classList.add('active');
    btn.onclick = () => onChange(target);
    return btn;
  };

  box.appendChild(createBtn('«', Math.max(1, page - 1)));
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let p = start; p <= end; p += 1) {
    box.appendChild(createBtn(String(p), p, p === page));
  }
  box.appendChild(createBtn('»', Math.min(pages, page + 1)));
}

function renderFileCards(files, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!files || files.length === 0) {
    container.innerHTML = '<div class="file-card"><div class="file-card-body">暂无数据</div></div>';
    return;
  }

  container.innerHTML = files.map((f) => {
    const tags = (f.tags || []).slice(0, 4).map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join('');
    return `
      <div class="file-card" onclick="openFileDetail(${f.file_id})">
        <div class="file-card-thumb">${fileIcon(f.file_type)}</div>
        <div class="file-card-body">
          <div class="file-card-name" title="${escapeHtml(f.original_name)}">${escapeHtml(f.original_name)}</div>
          <div class="file-card-meta">${formatSize(f.file_size)} · ${formatDate(f.upload_time)}</div>
          <div class="file-card-meta">播放 ${f.view_count || 0} · 下载 ${f.download_count || 0}</div>
          <div class="file-card-tags">${tags}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadHomePage() {
  const statsBox = document.getElementById('homeStats');
  if (statsBox) {
    const resp = await API.homeStats();
    const publicCount = resp.status === 200 ? (resp.data.public_file_count || 0) : 0;
    const userCount = resp.status === 200 ? (resp.data.user_count || 0) : 0;
    const privateCount = resp.status === 200 ? (resp.data.private_file_count || 0) : 0;
    statsBox.innerHTML = `
      <div class="stat-card"><div class="val">${publicCount}</div><div class="lbl">公开文件</div></div>
      <div class="stat-card"><div class="val">${userCount}</div><div class="lbl">用户总数</div></div>
      <div class="stat-card"><div class="val">${privateCount}</div><div class="lbl">私有文件数目</div></div>
    `;
  }

  const latest = await API.listFiles({ page: 1, per_page: 8, sort_by: 'upload_time', order: 'desc' });
  if (latest.status === 200) renderFileCards(latest.data.files || [], 'homeLatest');
}

async function loadCategoriesForSidebar() {
  const resp = await API.listCategories();
  const tree = document.getElementById('categoryTree');
  const uploadCategories = document.getElementById('uploadCategories');
  if (!tree) return;

  if (resp.status !== 200) {
    tree.innerHTML = '<li>分类加载失败</li>';
    if (uploadCategories) uploadCategories.innerHTML = '<span class="error-msg">分类加载失败</span>';
    return;
  }

  const categories = resp.data.categories || [];
  uploadCategoryTree = categories;
  const renderTree = (nodes, level = 0) => nodes.map((c) => `
    <li style="padding-left:${level * 12}px" onclick="filterByCategory(${c.category_id}); event.stopPropagation();">
      ${escapeHtml(c.category_name)}
    </li>
    ${(c.children && c.children.length) ? `<ul class="sub-cats">${renderTree(c.children, level + 1)}</ul>` : ''}
  `).join('');

  tree.innerHTML = `
    <li class="active" onclick="filterByCategory('')">全部分类</li>
    ${renderTree(categories)}
  `;

  if (uploadCategories) {
    const selected = document.getElementById('fileInput')?.files?.[0];
    const t = selected ? detectMediaTypeByName(selected.name) : '';
    renderUploadCategoryOptionsByType(t);
  }
}

async function loadTagCloud() {
  const resp = await API.listTags();
  const box = document.getElementById('tagCloud');
  if (!box) return;
  if (resp.status !== 200) {
    box.innerHTML = '<span class="error-msg">标签加载失败</span>';
    return;
  }
  const tags = (resp.data.tags || []).slice(0, 30);
  box.innerHTML = tags.map((t) => `<span class="tag" onclick="filterByTag(${t.tag_id})">${escapeHtml(t.tag_name)} (${t.file_count})</span>`).join('');
}

async function loadBrowseFiles(page = 1) {
  browseState.page = page;
  const resp = await API.listFiles(browseState);
  if (resp.status !== 200) {
    showToast(resp.data.msg || '加载文件失败');
    return;
  }
  renderFileCards(resp.data.files || [], 'browseGrid');
  buildPagination('browsePagination', resp.data.page || 1, resp.data.pages || 1, loadBrowseFiles);
}

function searchFiles() {
  browseState.keyword = document.getElementById('searchInput').value.trim();
  browseState.file_type = document.getElementById('filterType').value;
  browseState.sort_by = document.getElementById('sortBy').value;
  browseState.page = 1;
  loadBrowseFiles(1);
}

function filterByCategory(categoryId) {
  browseState.category_id = categoryId;
  browseState.page = 1;
  loadBrowseFiles(1);
}

function filterByTag(tagId) {
  browseState.tag_id = tagId;
  browseState.page = 1;
  loadBrowseFiles(1);
}

function setupUploadDragDrop() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  const hint = document.getElementById('uploadHint');
  const preview = document.getElementById('uploadPreview');
  if (!zone || !input) return;

  const updatePreview = () => {
    const f = input.files && input.files[0];
    if (!f) {
      if (preview) preview.style.display = 'none';
      if (hint) hint.style.display = '';
      renderUploadCategoryOptionsByType('');
      return;
    }
    if (hint) hint.style.display = 'none';
    if (preview) {
      preview.style.display = '';
      preview.innerHTML = `<b>${escapeHtml(f.name)}</b><br><small>${formatSize(f.size)}</small>`;
    }
    renderUploadCategoryOptionsByType(detectMediaTypeByName(f.name));
  };

  input.addEventListener('change', updatePreview);

  ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  }));

  ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
  }));

  zone.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    input.files = e.dataTransfer.files;
    updatePreview();
  });
}

async function submitUpload() {
  if (!localStorage.getItem('token') && typeof ensureCurrentUser === 'function') {
    await ensureCurrentUser();
  }

  const fileInput = document.getElementById('fileInput');
  const f = fileInput.files && fileInput.files[0];
  if (!f) {
    showToast('请选择要上传的文件');
    return;
  }

  const fd = new FormData();
  fd.append('file', f);
  fd.append('visibility', document.getElementById('uploadVisibility').value);
  fd.append('tags', document.getElementById('uploadTags').value.trim());
  fd.append('description', document.getElementById('uploadDesc').value.trim());

  const categoryIds = Array.from(document.querySelectorAll('#uploadCategories input[type="checkbox"]:checked'))
    .map((el) => el.value);
  categoryIds.forEach((id) => fd.append('category_ids', id));

  const progress = document.getElementById('uploadProgress');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  progress.style.display = '';
  fill.style.width = '0%';
  text.textContent = '0%';

  const resp = await API.uploadFile(fd, (p) => {
    fill.style.width = `${p}%`;
    text.textContent = `${p}%`;
  });

  if (resp.status === 201) {
    showToast('上传成功');
    document.getElementById('uploadForm').reset();
    document.getElementById('uploadHint').style.display = '';
    document.getElementById('uploadPreview').style.display = 'none';
    progress.style.display = 'none';
    loadMyFiles(1);
    loadBrowseFiles(1);
    loadHomePage();
    showPage('myfiles');
  } else if (resp.status === 401 || resp.status === 403) {
    progress.style.display = 'none';
    showToast(resp.data.msg || '请先登录后再上传');
    showPage('login');
  } else {
    progress.style.display = 'none';
    showToast(resp.data.msg || '上传失败');
  }
}

async function loadMyFiles(page = 1) {
  let user = currentUser;
  if (!user && typeof ensureCurrentUser === 'function') {
    user = await ensureCurrentUser();
  }
  if (!user) return;
  myFilesState.page = page;
  const resp = await API.myFiles(myFilesState);
  const body = document.getElementById('myFilesBody');
  if (!body) return;

  if (resp.status !== 200) {
    body.innerHTML = `<tr><td colspan="7">${escapeHtml(resp.data.msg || '加载失败')}</td></tr>`;
    return;
  }

  const files = resp.data.files || [];
  if (files.length === 0) {
    body.innerHTML = '<tr><td colspan="7">暂无文件</td></tr>';
  } else {
    body.innerHTML = files.map((f) => `
      <tr>
        <td title="${escapeHtml(f.original_name)}">${escapeHtml(f.original_name)}</td>
        <td>${f.file_type}</td>
        <td>${formatSize(f.file_size)}</td>
        <td>${visibilityText(f.visibility)}</td>
        <td>${formatDate(f.upload_time)}</td>
        <td>${f.view_count || 0}/${f.download_count || 0}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openFileDetail(${f.file_id})">查看</button>
          <button class="btn btn-outline btn-sm" onclick="openShareModal(${f.file_id})">分享</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMyFile(${f.file_id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  buildPagination('myFilesPagination', resp.data.page || 1, resp.data.pages || 1, loadMyFiles);
}

async function deleteMyFile(fileId) {
  if (!confirm('确认删除该文件吗？')) return;
  const resp = await API.deleteFile(fileId);
  if (resp.status === 200) {
    showToast('删除成功');
    loadMyFiles(myFilesState.page);
    loadBrowseFiles(browseState.page);
    loadHomePage();
  } else {
    showToast(resp.data.msg || '删除失败');
  }
}

async function openFileDetail(fileId) {
  const resp = await API.getFile(fileId);
  if (resp.status !== 200) {
    showToast(resp.data.msg || '读取文件详情失败');
    return;
  }

  const f = resp.data.file;
  const streamUrl = API.streamUrl(f.file_id);
  const isAudio = f.file_type === 'audio';
  const media = isAudio
    ? `<audio controls src="${streamUrl}"></audio>`
    : `<video controls src="${streamUrl}"></video>`;

  const tags = (f.tags || []).map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`).join('');
  const categories = (f.categories || []).map((c) => `<span class="tag">${escapeHtml(c.name)}</span>`).join('');

  document.getElementById('fileDetailContent').innerHTML = `
    <div class="file-detail">
      <div class="file-player">${media}</div>
      <div class="file-info">
        <h2>${escapeHtml(f.original_name)}</h2>
        <div class="file-meta-grid">
          <div class="file-meta-item"><div class="k">文件类型</div><div class="v">${escapeHtml(f.file_type)}</div></div>
          <div class="file-meta-item"><div class="k">文件大小</div><div class="v">${formatSize(f.file_size)}</div></div>
          <div class="file-meta-item"><div class="k">上传者</div><div class="v">${escapeHtml(f.uploader_name || '-')}</div></div>
          <div class="file-meta-item"><div class="k">上传时间</div><div class="v">${formatDate(f.upload_time)}</div></div>
          <div class="file-meta-item"><div class="k">可见性</div><div class="v">${visibilityText(f.visibility)}</div></div>
          <div class="file-meta-item"><div class="k">播放/下载</div><div class="v">${f.view_count || 0}/${f.download_count || 0}</div></div>
        </div>
        <div><b>分类：</b>${categories || '-'}</div>
        <div style="margin-top:.4rem"><b>标签：</b>${tags || '-'}</div>
        <div style="margin-top:.6rem"><b>描述：</b>${escapeHtml(f.description || '暂无描述')}</div>
        <div class="file-actions">
          <a class="btn btn-primary" href="${API.downloadUrl(f.file_id)}">下载文件</a>
          ${currentUser ? `<button class="btn btn-outline" onclick="openShareModal(${f.file_id})">创建分享</button>` : ''}
          <button class="btn btn-outline" onclick="showPage('browse')">返回列表</button>
        </div>
      </div>
    </div>
  `;

  showPage('filedetail');
}

async function openShareModal(fileId) {
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  title.textContent = '创建分享';
  body.innerHTML = `
    <div class="form-group">
      <label>访问限制（0 表示不限）</label>
      <input id="shareAccessLimit" type="number" min="0" value="0" />
    </div>
    <div class="form-group">
      <label>过期时间（可留空）</label>
      <input id="shareExpireAt" type="datetime-local" />
    </div>
  `;
  window.__modalAction = async () => {
    const access_limit = Number(document.getElementById('shareAccessLimit').value || 0);
    const expireRaw = document.getElementById('shareExpireAt').value;
    const payload = { file_id: fileId, access_limit };
    if (expireRaw) payload.expire_at = new Date(expireRaw).toISOString();

    const resp = await API.createShare(payload);
    if (resp.status === 201) {
      closeModal();
      showToast('分享已创建，分享码：' + resp.data.share.share_code);
      loadMyShares(1);
    } else {
      showToast(resp.data.msg || '创建分享失败');
    }
  };
  openModal();
}

async function loadMyShares(page = 1) {
  if (!currentUser) return;
  sharesState.page = page;
  const resp = await API.myShares(sharesState);
  const body = document.getElementById('sharesBody');
  if (!body) return;

  if (resp.status !== 200) {
    body.innerHTML = `<tr><td colspan="7">${escapeHtml(resp.data.msg || '加载失败')}</td></tr>`;
    return;
  }

  const shares = resp.data.shares || [];
  if (shares.length === 0) {
    body.innerHTML = '<tr><td colspan="7">暂无分享</td></tr>';
  } else {
    body.innerHTML = shares.map((s) => `
      <tr>
        <td>${escapeHtml(s.file_name || '-')}</td>
        <td><span class="badge badge-info">${escapeHtml(s.share_code)}</span></td>
        <td>${s.expire_at ? formatDate(s.expire_at) : '永久'}</td>
        <td>${s.access_limit || 0}</td>
        <td>${s.access_count || 0}</td>
        <td>${Number(s.status) === 1 ? '<span class="badge badge-success">有效</span>' : '<span class="badge badge-danger">失效</span>'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="copyShareCode('${escapeHtml(s.share_code)}')">复制码</button>
          ${Number(s.status) === 1 ? `<button class="btn btn-danger btn-sm" onclick="revokeShare(${s.share_id})">吊销</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  buildPagination('sharesPagination', resp.data.page || 1, resp.data.pages || 1, loadMyShares);
}

function copyShareCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('分享码已复制');
  }).catch(() => {
    showToast('复制失败，请手动复制：' + code);
  });
}

async function revokeShare(shareId) {
  if (!confirm('确认吊销该分享？')) return;
  const resp = await API.revokeShare(shareId);
  if (resp.status === 200) {
    showToast('已吊销');
    loadMyShares(sharesState.page);
  } else {
    showToast(resp.data.msg || '吊销失败');
  }
}

function initShareAccessPage() {
  const input = document.getElementById('shareCodeInput');
  const result = document.getElementById('shareAccessResult');
  if (result) result.innerHTML = '';
  if (!input) return;
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') accessShareByCode();
  }, { once: true });
}

async function accessShareByCode() {
  const input = document.getElementById('shareCodeInput');
  const result = document.getElementById('shareAccessResult');
  if (!input || !result) return;

  const code = input.value.trim();
  if (!code) {
    showToast('请输入分享码');
    return;
  }

  result.innerHTML = '<div class="file-meta-item"><div class="k">状态</div><div class="v">正在校验分享码...</div></div>';
  const resp = await API.accessShare(code);
  if (resp.status !== 200) {
    result.innerHTML = `<div class="error-msg">${escapeHtml(resp.data.msg || '分享码无效')}</div>`;
    return;
  }

  const file = resp.data.file || {};
  const share = resp.data.share || {};
  result.innerHTML = `
    <div class="file-info">
      <h2>${escapeHtml(file.original_name || '未命名文件')}</h2>
      <div class="file-meta-grid">
        <div class="file-meta-item"><div class="k">文件类型</div><div class="v">${escapeHtml(file.file_type || '-')}</div></div>
        <div class="file-meta-item"><div class="k">文件大小</div><div class="v">${formatSize(file.file_size || 0)}</div></div>
        <div class="file-meta-item"><div class="k">分享者</div><div class="v">${escapeHtml(share.sharer_name || '-')}</div></div>
        <div class="file-meta-item"><div class="k">过期时间</div><div class="v">${share.expire_at ? formatDate(share.expire_at) : '永久'}</div></div>
      </div>
      <div class="file-actions">
        <button class="btn btn-outline" onclick="copyShareCode('${escapeHtml(code)}')">复制分享码</button>
        <button class="btn btn-primary" onclick="openFileDetail(${file.file_id})">打开详情</button>
      </div>
    </div>
  `;
}
