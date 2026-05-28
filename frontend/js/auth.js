/**
 * auth.js  —  登录、注册、用户状态管理
 */

let currentUser = null;

function updateNavByUser() {
  const loggedIn = !!currentUser;
  const isAdmin  = loggedIn && currentUser.roles && currentUser.roles.includes('admin');

  document.getElementById('btnLogin').style.display    = loggedIn ? 'none' : '';
  document.getElementById('btnRegister').style.display = loggedIn ? 'none' : '';
  document.getElementById('btnLogout').style.display   = loggedIn ? '' : 'none';
  document.getElementById('navUsername').style.display = loggedIn ? '' : 'none';
  document.getElementById('navUsername').textContent   = loggedIn ? ('👤 ' + currentUser.username) : '';

  document.getElementById('navUpload').style.display   = loggedIn ? '' : 'none';
  document.getElementById('navMyFiles').style.display  = loggedIn ? '' : 'none';
  document.getElementById('navShares').style.display   = loggedIn ? '' : 'none';
  document.getElementById('navAdmin').style.display    = isAdmin  ? '' : 'none';

  const heroUploadBtn = document.getElementById('heroUploadBtn');
  if (heroUploadBtn) heroUploadBtn.style.display = loggedIn ? '' : 'none';
}

async function restoreSession() {
  const token = localStorage.getItem('token');
  if (!token) { updateNavByUser(); return; }
  const resp = await API.profile();
  if (resp.status === 200) {
    currentUser = resp.data.user;
  } else {
    localStorage.removeItem('token');
    currentUser = null;
  }
  updateNavByUser();
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = '请填写用户名和密码';
    errEl.style.display = '';
    return;
  }

  const resp = await API.login({ username, password });
  if (resp.status === 200) {
    localStorage.setItem('token', resp.data.token);
    currentUser = resp.data.user;
    updateNavByUser();
    showToast('登录成功，欢迎回来 ' + currentUser.username + '！');
    showPage('home');
    loadHomePage();
  } else {
    errEl.textContent = resp.data.msg || '登录失败';
    errEl.style.display = '';
  }
}

async function doRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('regError');
  errEl.style.display = 'none';

  if (!username || !email || !password) {
    errEl.textContent = '请填写所有必填字段';
    errEl.style.display = '';
    return;
  }

  const resp = await API.register({ username, email, password });
  if (resp.status === 201) {
    showToast('注册成功，请登录！');
    showPage('login');
    document.getElementById('loginUsername').value = username;
  } else {
    errEl.textContent = resp.data.msg || '注册失败';
    errEl.style.display = '';
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  updateNavByUser();
  showToast('已退出登录');
  showPage('home');
  loadHomePage();
}
