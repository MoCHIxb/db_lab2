/**
 * app.js  —  全局页面调度与通用交互
 */

let currentPage = 'home';
window.__modalAction = null;

function showToast(msg, timeout = 2200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, timeout);
}

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'flex';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  window.__modalAction = null;
}

function modalConfirmAction() {
  if (typeof window.__modalAction === 'function') window.__modalAction();
}

function showPage(pageName) {
  const protectedPages = ['upload', 'myfiles', 'shares'];
  const hasToken = !!localStorage.getItem('token');
  if (protectedPages.includes(pageName) && !currentUser && !hasToken) {
    showToast('请先登录');
    pageName = 'login';
  }

  if (pageName === 'admin' && (!currentUser || !currentUser.roles?.includes('admin'))) {
    showToast('仅管理员可访问');
    pageName = 'home';
  }

  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageName}`);
  if (!target) return;
  target.classList.add('active');
  currentPage = pageName;

  if (pageName === 'home') loadHomePage();
  if (pageName === 'browse') {
    loadCategoriesForSidebar();
    loadTagCloud();
    loadBrowseFiles(1);
  }
  if (pageName === 'upload') {
    loadCategoriesForSidebar();
  }
  if (pageName === 'myfiles') loadMyFiles(1);
  if (pageName === 'shares') loadMyShares(1);
  if (pageName === 'apitest') initApiTester();
  if (pageName === 'admin') {
    adminTab('dashboard');
  }
}

function bindGlobalEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchFiles();
    });
  }

  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  }

  const regPassword = document.getElementById('regPassword');
  if (regPassword) {
    regPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRegister();
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  setupUploadDragDrop();
  bindGlobalEvents();
  await restoreSession();
  showPage('home');

  // 支持通过 URL hash 打开分享访问，例如 #share=ABC123
  const hash = location.hash || '';
  if (hash.startsWith('#share=')) {
    const code = decodeURIComponent(hash.replace('#share=', '').trim());
    if (code) {
      const resp = await API.accessShare(code);
      if (resp.status === 200 && resp.data.file?.file_id) {
        showToast('分享访问成功');
        openFileDetail(resp.data.file.file_id);
      } else {
        showToast(resp.data.msg || '分享链接无效');
      }
    }
  }
});
