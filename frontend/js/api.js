/**
 * api.js  —  封装所有后端接口调用
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('token') || '';
}

function tokenQuery() {
  const token = getToken();
  if (!token) return '';
  return `?token=${encodeURIComponent(token)}`;
}

async function request(method, path, data = null, isFile = false) {
  const headers = {};
  if (getToken()) headers['Authorization'] = 'Bearer ' + getToken();

  const opts = { method, headers };
  if (data && !isFile) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  } else if (data && isFile) {
    opts.body = data; // FormData
  }

  const res = await fetch(BASE + path, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

const API = {
  // Auth
  register: (d)     => request('POST', '/auth/register', d),
  login:    (d)     => request('POST', '/auth/login', d),
  profile:  ()      => request('GET',  '/auth/profile'),
  updateProfile:(d) => request('PUT',  '/auth/profile', d),
  changePassword:(d)=> request('PUT',  '/auth/password', d),
  forgotPassword:(d)=> request('POST', '/auth/forgot-password', d),
  resetPassword:(d) => request('POST', '/auth/reset-password', d),
  uploadAvatar:(fd) => request('POST', '/auth/avatar', fd, true),

  // Files
  homeStats:  ()       => request('GET',  '/files/stats/overview'),
  listFiles:  (params) => request('GET',  '/files?' + new URLSearchParams(params)),
  myFiles:    (params) => request('GET',  '/files/my?' + new URLSearchParams(params)),
  getFile:    (id)     => request('GET',  `/files/${id}`),
  deleteFile: (id)     => request('DELETE',`/files/${id}`),
  updateFile: (id, d)  => request('PUT',  `/files/${id}`, d),
  streamUrl:  (id)     => BASE + `/files/${id}/stream${tokenQuery()}`,
  downloadUrl:(id)     => BASE + `/files/${id}/download${tokenQuery()}`,

  uploadFile: (fd, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', BASE + '/files/upload');
      if (getToken()) xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      });
      xhr.onload = () => {
        try { resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) }); }
        catch(e) { resolve({ status: xhr.status, data: {} }); }
      };
      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.send(fd);
    });
  },

  // File permissions
  getFilePerms:   (fid)      => request('GET',    `/files/${fid}/permissions`),
  addFilePerm:    (fid, d)   => request('POST',   `/files/${fid}/permissions`, d),
  removeFilePerm: (fid, pid) => request('DELETE', `/files/${fid}/permissions/${pid}`),

  // Categories
  listCategories: ()       => request('GET',    '/categories'),
  createCategory: (d)      => request('POST',   '/categories', d),
  updateCategory: (id, d)  => request('PUT',    `/categories/${id}`, d),
  deleteCategory: (id)     => request('DELETE', `/categories/${id}`),

  // Tags
  listTags: () => request('GET', '/tags'),

  // Shares
  createShare: (d)     => request('POST',   '/shares', d),
  myShares:    (params)=> request('GET',    '/shares/my?' + new URLSearchParams(params)),
  accessShare: (code)  => request('GET',    `/shares/access/${code}`),
  revokeShare: (id)    => request('DELETE', `/shares/${id}`),

  // Logs
  getLogs:  (params) => request('GET', '/logs?' + new URLSearchParams(params)),

  // Admin
  adminStats:        ()      => request('GET',  '/admin/stats'),
  adminUsers:        (params)=> request('GET',  '/admin/users?' + new URLSearchParams(params)),
  adminToggleStatus: (uid)   => request('PUT',  `/admin/users/${uid}/status`),
  adminSetRole:      (uid,d) => request('PUT',  `/admin/users/${uid}/role`, d),
  adminCreateUser:   (d)     => request('POST', '/admin/users', d),
  adminFiles:        (params)=> request('GET',  '/admin/files?' + new URLSearchParams(params)),
};
