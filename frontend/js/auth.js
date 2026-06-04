/**
 * auth.js  —  登录、注册、用户状态管理
 */

let currentUser = null;

function defaultAvatarDataUri(name = 'U') {
  const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#dbe8ff"/><text x="50%" y="56%" text-anchor="middle" font-size="42" font-family="Arial" fill="#2c6fad">${initial}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function resolveAvatar(url, username) {
  if (!url) return defaultAvatarDataUri(username);
  return url;
}

function updateNavByUser() {
  const loggedIn = !!currentUser;
  const isAdmin  = loggedIn && currentUser.roles && currentUser.roles.includes('admin');

  document.getElementById('btnLogin').style.display    = loggedIn ? 'none' : '';
  document.getElementById('btnRegister').style.display = loggedIn ? 'none' : '';
  document.getElementById('btnLogout').style.display   = loggedIn ? '' : 'none';
  document.getElementById('navUsername').style.display = loggedIn ? '' : 'none';
  document.getElementById('navUsername').textContent   = loggedIn ? currentUser.username : '';

  const navAccount = document.getElementById('navAccount');
  if (navAccount) navAccount.style.display = loggedIn ? '' : 'none';

  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar) {
    navAvatar.src = loggedIn ? resolveAvatar(currentUser.avatar_url, currentUser.username) : defaultAvatarDataUri('U');
  }

  document.getElementById('navUpload').style.display   = loggedIn ? '' : 'none';
  document.getElementById('navMyFiles').style.display  = loggedIn ? '' : 'none';
  document.getElementById('navShares').style.display   = loggedIn ? '' : 'none';
  const navApiTest = document.getElementById('navApiTest');
  if (navApiTest) navApiTest.style.display = isAdmin ? '' : 'none';
  document.getElementById('navAdmin').style.display    = isAdmin  ? '' : 'none';

  const heroUploadBtn = document.getElementById('heroUploadBtn');
  if (heroUploadBtn) heroUploadBtn.style.display = loggedIn ? '' : 'none';

  const heroWelcome = document.getElementById('heroWelcome');
  if (heroWelcome) {
    heroWelcome.textContent = loggedIn
      ? `欢迎回来，${currentUser.username}！开始管理你的音像内容吧。`
      : '欢迎来到音像云，登录后可上传、分享并管理你的音像文件。';
  }
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

async function ensureCurrentUser() {
  if (currentUser) return currentUser;

  const token = localStorage.getItem('token');
  if (!token) return null;

  const resp = await API.profile();
  if (resp.status === 200) {
    currentUser = resp.data.user;
    updateNavByUser();
    return currentUser;
  }

  localStorage.removeItem('token');
  currentUser = null;
  updateNavByUser();
  return null;
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

async function loadProfilePage() {
  const user = await ensureCurrentUser();
  if (!user) {
    showToast('请先登录');
    showPage('login');
    return;
  }

  const usernameEl = document.getElementById('profileUsername');
  const emailEl = document.getElementById('profileEmail');
  const phoneEl = document.getElementById('profilePhone');
  const avatarEl = document.getElementById('profileAvatarImg');

  if (usernameEl) usernameEl.value = user.username || '';
  if (emailEl) emailEl.value = user.email || '';
  if (phoneEl) phoneEl.value = user.phone || '';
  if (avatarEl) avatarEl.src = resolveAvatar(user.avatar_url, user.username);
}

async function saveProfile() {
  const email = (document.getElementById('profileEmail')?.value || '').trim();
  const phone = (document.getElementById('profilePhone')?.value || '').trim();

  if (!email) {
    showToast('邮箱不能为空');
    return;
  }

  const resp = await API.updateProfile({ email, phone });
  if (resp.status === 200) {
    currentUser = resp.data.user;
    updateNavByUser();
    showToast('个人资料已更新');
  } else {
    showToast(resp.data.msg || '更新失败');
  }
}

async function uploadAvatar() {
  const input = document.getElementById('profileAvatarFile');
  if (!input || !input.files || !input.files[0]) {
    showToast('请先选择头像文件');
    return;
  }

  const fd = new FormData();
  fd.append('avatar', input.files[0]);
  const resp = await API.uploadAvatar(fd);
  if (resp.status === 200) {
    currentUser = resp.data.user;
    updateNavByUser();
    const avatarEl = document.getElementById('profileAvatarImg');
    if (avatarEl) avatarEl.src = resolveAvatar(currentUser.avatar_url, currentUser.username);
    input.value = '';
    showToast('头像上传成功');
  } else {
    showToast(resp.data.msg || '头像上传失败');
  }
}

async function submitChangePassword() {
  const old_password = document.getElementById('oldPassword')?.value || '';
  const new_password = document.getElementById('newPassword')?.value || '';
  const confirm_password = document.getElementById('confirmPassword')?.value || '';

  if (!old_password || !new_password) {
    showToast('请填写旧密码和新密码');
    return;
  }
  if (new_password.length < 6) {
    showToast('新密码不能少于 6 个字符');
    return;
  }
  if (new_password !== confirm_password) {
    showToast('两次输入的新密码不一致');
    return;
  }

  const resp = await API.changePassword({ old_password, new_password });
  if (resp.status === 200) {
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showToast('密码已修改，请牢记新密码');
  } else {
    showToast(resp.data.msg || '修改密码失败');
  }
}

async function requestPasswordReset() {
  const username = (document.getElementById('forgotUsername')?.value || '').trim();
  const email = (document.getElementById('forgotEmail')?.value || '').trim();
  if (!username || !email) {
    showToast('请输入用户名和邮箱');
    return;
  }

  const resp = await API.forgotPassword({ username, email });
  if (resp.status === 200) {
    showToast(resp.data.msg || '请求成功');
    const token = resp.data.reset_token || '';
    const tokenEl = document.getElementById('resetToken');
    if (tokenEl && token) tokenEl.value = token;
    if (token) {
      const showEl = document.getElementById('resetTokenHint');
      if (showEl) {
        showEl.textContent = '演示环境重置凭证：' + token;
        showEl.style.display = '';
      }
      showPage('resetpwd');
    }
  } else {
    showToast(resp.data.msg || '请求失败');
  }
}

async function submitResetPassword() {
  const token = (document.getElementById('resetToken')?.value || '').trim();
  const new_password = document.getElementById('resetNewPassword')?.value || '';
  const confirm = document.getElementById('resetConfirmPassword')?.value || '';

  if (!token || !new_password) {
    showToast('请填写重置凭证和新密码');
    return;
  }
  if (new_password.length < 6) {
    showToast('新密码不能少于 6 个字符');
    return;
  }
  if (new_password !== confirm) {
    showToast('两次输入的新密码不一致');
    return;
  }

  const resp = await API.resetPassword({ token, new_password });
  if (resp.status === 200) {
    showToast('密码重置成功，请登录');
    document.getElementById('resetNewPassword').value = '';
    document.getElementById('resetConfirmPassword').value = '';
    showPage('login');
  } else {
    showToast(resp.data.msg || '重置失败');
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
