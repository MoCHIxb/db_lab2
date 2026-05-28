/**
 * admin.js  —  管理后台逻辑
 */

let adminUsersState = { page: 1, per_page: 10, keyword: '' };
let adminFilesState = { page: 1, per_page: 10, keyword: '' };
let adminLogsState = { page: 1, per_page: 15, action: '' };

function escapeJsSingleQuoted(text) {
  return String(text ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function adminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.admin-sidebar li').forEach((el) => el.classList.remove('active'));

  const map = {
    dashboard: 'admin-dashboard',
    users: 'admin-users',
    allfiles: 'admin-allfiles',
    categories: 'admin-categories',
    logs: 'admin-logs',
  };

  const tabId = map[tabName];
  document.getElementById(tabId)?.classList.add('active');
  const li = Array.from(document.querySelectorAll('.admin-sidebar li')).find((x) => x.getAttribute('onclick')?.includes(tabName));
  if (li) li.classList.add('active');

  if (tabName === 'dashboard') loadAdminStats();
  if (tabName === 'users') loadAdminUsers(1);
  if (tabName === 'allfiles') loadAdminFiles(1);
  if (tabName === 'categories') loadAdminCategories();
  if (tabName === 'logs') loadAdminLogs(1);
}

async function loadAdminStats() {
  const box = document.getElementById('adminStats');
  if (!box) return;
  const resp = await API.adminStats();
  if (resp.status !== 200) {
    box.innerHTML = '<div class="stat-card">统计加载失败</div>';
    return;
  }

  box.innerHTML = `
    <div class="stat-card"><div class="val">${resp.data.user_count || 0}</div><div class="lbl">用户总数</div></div>
    <div class="stat-card"><div class="val">${resp.data.file_count || 0}</div><div class="lbl">文件总数</div></div>
    <div class="stat-card"><div class="val">${resp.data.share_count || 0}</div><div class="lbl">分享记录</div></div>
    <div class="stat-card"><div class="val">${resp.data.log_count || 0}</div><div class="lbl">访问日志</div></div>
    <div class="stat-card"><div class="val">${formatSize(resp.data.total_size || 0)}</div><div class="lbl">总存储量</div></div>
  `;
}

async function loadAdminUsers(page = 1) {
  adminUsersState.page = page;
  const resp = await API.adminUsers(adminUsersState);
  const body = document.getElementById('usersBody');
  if (!body) return;

  if (resp.status !== 200) {
    body.innerHTML = `<tr><td colspan="7">${escapeHtml(resp.data.msg || '加载失败')}</td></tr>`;
    return;
  }

  const users = resp.data.users || [];
  if (users.length === 0) {
    body.innerHTML = '<tr><td colspan="7">暂无用户</td></tr>';
  } else {
    body.innerHTML = users.map((u) => {
      const role = (u.roles || []).join(', ') || 'user';
      return `
        <tr>
          <td>${u.user_id}</td>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(u.email || '-')}</td>
          <td>${escapeHtml(role)}</td>
          <td>${Number(u.status) === 1 ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-danger">禁用</span>'}</td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="toggleUserStatus(${u.user_id})">切换状态</button>
            <button class="btn btn-outline btn-sm" onclick="setUserRole(${u.user_id}, '${role.includes('admin') ? 'user' : 'admin'}')">设为${role.includes('admin') ? '用户' : '管理员'}</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  buildPagination('usersPagination', resp.data.page || 1, resp.data.pages || 1, loadAdminUsers);
}

function searchUsers() {
  adminUsersState.keyword = document.getElementById('userSearchInput').value.trim();
  loadAdminUsers(1);
}

async function toggleUserStatus(userId) {
  const resp = await API.adminToggleStatus(userId);
  if (resp.status === 200) {
    showToast('用户状态已更新');
    loadAdminUsers(adminUsersState.page);
  } else {
    showToast(resp.data.msg || '操作失败');
  }
}

async function setUserRole(userId, roleName) {
  if (!confirm(`确认将该用户设为 ${roleName}？`)) return;
  const resp = await API.adminSetRole(userId, { role_name: roleName });
  if (resp.status === 200) {
    showToast('角色更新成功');
    loadAdminUsers(adminUsersState.page);
  } else {
    showToast(resp.data.msg || '角色更新失败');
  }
}

function showCreateUserModal() {
  document.getElementById('modalTitle').textContent = '新建用户';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>用户名</label><input id="newUserName" /></div>
    <div class="form-group"><label>邮箱</label><input id="newUserEmail" type="email" /></div>
    <div class="form-group"><label>密码</label><input id="newUserPassword" type="password" /></div>
    <div class="form-group">
      <label>角色</label>
      <select id="newUserRole"><option value="user">user</option><option value="admin">admin</option></select>
    </div>
  `;
  window.__modalAction = async () => {
    const payload = {
      username: document.getElementById('newUserName').value.trim(),
      email: document.getElementById('newUserEmail').value.trim(),
      password: document.getElementById('newUserPassword').value,
      role: document.getElementById('newUserRole').value,
    };
    const resp = await API.adminCreateUser(payload);
    if (resp.status === 201) {
      closeModal();
      showToast('用户创建成功');
      loadAdminUsers(1);
    } else {
      showToast(resp.data.msg || '创建失败');
    }
  };
  openModal();
}

async function loadAdminFiles(page = 1) {
  adminFilesState.page = page;
  const resp = await API.adminFiles(adminFilesState);
  const body = document.getElementById('adminFilesBody');
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
        <td>${f.file_id}</td>
        <td>${escapeHtml(f.original_name)}</td>
        <td>${escapeHtml(f.file_type)}</td>
        <td>${escapeHtml(f.uploader_name || '-')}</td>
        <td>${formatSize(f.file_size)}</td>
        <td>${visibilityText(f.visibility)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openFileDetail(${f.file_id})">查看</button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteFile(${f.file_id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  buildPagination('adminFilesPagination', resp.data.page || 1, resp.data.pages || 1, loadAdminFiles);
}

function searchAdminFiles() {
  adminFilesState.keyword = document.getElementById('fileSearchInput').value.trim();
  loadAdminFiles(1);
}

async function adminDeleteFile(fileId) {
  if (!confirm('确认删除该文件？')) return;
  const resp = await API.deleteFile(fileId);
  if (resp.status === 200) {
    showToast('删除成功');
    loadAdminFiles(adminFilesState.page);
  } else {
    showToast(resp.data.msg || '删除失败');
  }
}

async function loadAdminCategories() {
  const box = document.getElementById('categoryAdmin');
  if (!box) return;
  const resp = await API.listCategories();
  if (resp.status !== 200) {
    box.innerHTML = '<p class="error-msg">分类加载失败</p>';
    return;
  }

  const render = (nodes, level = 0) => {
    return (nodes || []).map((c) => `
      <div style="margin-left:${level * 20}px; padding:.4rem 0; border-bottom:1px solid #eef2f7;">
        <b>${escapeHtml(c.category_name)}</b>
        <span style="color:#7f8c9a; margin-left:.4rem;">(ID: ${c.category_id})</span>
        <button class="btn btn-outline btn-sm" style="margin-left:.6rem" onclick="showEditCategoryModal(${c.category_id}, '${escapeJsSingleQuoted(c.category_name)}', ${c.parent_id ?? 'null'})">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.category_id})">删除</button>
      </div>
      ${render(c.children || [], level + 1)}
    `).join('');
  };

  box.innerHTML = render(resp.data.categories || []);
}

function showCreateCategoryModal() {
  document.getElementById('modalTitle').textContent = '新建分类';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>分类名</label><input id="newCatName" /></div>
    <div class="form-group"><label>父分类ID（可空）</label><input id="newCatParent" type="number" /></div>
    <div class="form-group"><label>排序值</label><input id="newCatSort" type="number" value="0" /></div>
  `;
  window.__modalAction = async () => {
    const payload = {
      category_name: document.getElementById('newCatName').value.trim(),
      sort_order: Number(document.getElementById('newCatSort').value || 0),
    };
    const parentRaw = document.getElementById('newCatParent').value;
    if (parentRaw) payload.parent_id = Number(parentRaw);

    const resp = await API.createCategory(payload);
    if (resp.status === 201) {
      closeModal();
      showToast('分类已创建');
      loadAdminCategories();
      loadCategoriesForSidebar();
    } else {
      showToast(resp.data.msg || '创建失败');
    }
  };
  openModal();
}

function showEditCategoryModal(categoryId, name, parentId) {
  document.getElementById('modalTitle').textContent = '编辑分类';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>分类名</label><input id="editCatName" value="${name}" /></div>
    <div class="form-group"><label>父分类ID（可空）</label><input id="editCatParent" type="number" value="${parentId ?? ''}" /></div>
    <div class="form-group"><label>排序值</label><input id="editCatSort" type="number" value="0" /></div>
  `;
  window.__modalAction = async () => {
    const payload = {
      category_name: document.getElementById('editCatName').value.trim(),
      sort_order: Number(document.getElementById('editCatSort').value || 0),
    };
    const parentRaw = document.getElementById('editCatParent').value;
    payload.parent_id = parentRaw ? Number(parentRaw) : null;

    const resp = await API.updateCategory(categoryId, payload);
    if (resp.status === 200) {
      closeModal();
      showToast('分类已更新');
      loadAdminCategories();
      loadCategoriesForSidebar();
    } else {
      showToast(resp.data.msg || '更新失败');
    }
  };
  openModal();
}

async function deleteCategory(categoryId) {
  if (!confirm('确认删除该分类？')) return;
  const resp = await API.deleteCategory(categoryId);
  if (resp.status === 200) {
    showToast('分类已删除');
    loadAdminCategories();
    loadCategoriesForSidebar();
  } else {
    showToast(resp.data.msg || '删除失败');
  }
}

async function loadAdminLogs(page = 1) {
  adminLogsState.page = page;
  adminLogsState.action = document.getElementById('logActionFilter')?.value || '';

  const resp = await API.getLogs(adminLogsState);
  const body = document.getElementById('logsBody');
  if (!body) return;

  if (resp.status !== 200) {
    body.innerHTML = `<tr><td colspan="5">${escapeHtml(resp.data.msg || '加载失败')}</td></tr>`;
    return;
  }

  const logs = resp.data.logs || [];
  if (logs.length === 0) {
    body.innerHTML = '<tr><td colspan="5">暂无日志</td></tr>';
  } else {
    body.innerHTML = logs.map((l) => `
      <tr>
        <td>${escapeHtml(l.username || '-')}</td>
        <td>${escapeHtml(l.file_name || '-')}</td>
        <td>${escapeHtml(l.action || '-')}</td>
        <td>${formatDate(l.access_time)}</td>
        <td>${escapeHtml(l.ip_address || '-')}</td>
      </tr>
    `).join('');
  }

  buildPagination('logsPagination', resp.data.page || 1, resp.data.pages || 1, loadAdminLogs);
}
