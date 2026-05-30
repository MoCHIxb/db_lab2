/**
 * api_tester.js  —  网页可视化 API 调试工具
 */

function apiFillLoginExample() {
  const method = document.getElementById('apiMethod');
  const url = document.getElementById('apiUrl');
  const headers = document.getElementById('apiHeaders');
  const body = document.getElementById('apiBody');

  method.value = 'POST';
  url.value = '/api/auth/login';
  headers.value = 'Content-Type: application/json';
  body.value = JSON.stringify({ username: 'u1', password: '123456' }, null, 2);
}

function apiFillRegisterExample() {
  const method = document.getElementById('apiMethod');
  const url = document.getElementById('apiUrl');
  const headers = document.getElementById('apiHeaders');
  const body = document.getElementById('apiBody');

  method.value = 'POST';
  url.value = '/api/auth/register';
  headers.value = 'Content-Type: application/json';
  body.value = JSON.stringify({ username: 'u_demo', email: 'u_demo@example.com', password: '123456' }, null, 2);
}

function apiClearForm() {
  document.getElementById('apiHeaders').value = '';
  document.getElementById('apiBody').value = '';
  document.getElementById('apiStatus').textContent = '等待请求...';
  document.getElementById('apiResponseHeaders').textContent = '-';
  document.getElementById('apiResponseBody').textContent = '-';
}

function apiBuildHeaders() {
  const headers = {};
  const raw = document.getElementById('apiHeaders').value || '';
  raw.split('\n').forEach((line) => {
    const text = line.trim();
    if (!text) return;
    const idx = text.indexOf(':');
    if (idx < 1) return;
    const key = text.slice(0, idx).trim();
    const val = text.slice(idx + 1).trim();
    if (key) headers[key] = val;
  });

  if (document.getElementById('apiUseToken').checked) {
    const token = localStorage.getItem('token') || '';
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function apiNormalizeUrl(input) {
  const text = (input || '').trim();
  if (!text) return '/api/auth/login';
  if (text.startsWith('http://') || text.startsWith('https://')) return text;
  if (text.startsWith('/')) return text;
  return '/' + text;
}

function apiTryParseJson(text) {
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

async function apiSendRequest() {
  const method = document.getElementById('apiMethod').value;
  const url = apiNormalizeUrl(document.getElementById('apiUrl').value);
  const statusEl = document.getElementById('apiStatus');
  const headersEl = document.getElementById('apiResponseHeaders');
  const bodyEl = document.getElementById('apiResponseBody');

  let headers = {};
  try {
    headers = apiBuildHeaders();
  } catch (e) {
    showToast('请求头解析失败');
    return;
  }

  const options = { method, headers };
  const bodyText = document.getElementById('apiBody').value || '';

  if (method !== 'GET' && method !== 'HEAD') {
    if (bodyText.trim()) {
      const contentType = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
      if (contentType.includes('application/json') || (!contentType && bodyText.trim().startsWith('{'))) {
        try {
          const parsed = apiTryParseJson(bodyText);
          options.body = JSON.stringify(parsed);
          if (!contentType) headers['Content-Type'] = 'application/json';
        } catch (e) {
          showToast('JSON 请求体格式错误');
          return;
        }
      } else {
        options.body = bodyText;
      }
    }
  }

  statusEl.textContent = '请求发送中...';
  headersEl.textContent = '-';
  bodyEl.textContent = '-';

  try {
    const response = await fetch(url, options);
    const rawText = await response.text();

    const responseHeaders = [];
    response.headers.forEach((value, key) => {
      responseHeaders.push(`${key}: ${value}`);
    });

    let prettyBody = rawText;
    try {
      const json = JSON.parse(rawText);
      prettyBody = JSON.stringify(json, null, 2);
    } catch (_) {
      // keep raw text
    }

    statusEl.textContent = `HTTP ${response.status} ${response.statusText}`;
    statusEl.style.background = response.ok ? '#ecfff2' : '#fff3f3';
    statusEl.style.borderColor = response.ok ? '#bde8cc' : '#ffd3d3';

    headersEl.textContent = responseHeaders.length ? responseHeaders.join('\n') : '(无响应头)';
    bodyEl.textContent = prettyBody || '(空响应体)';
  } catch (e) {
    statusEl.textContent = '请求失败（网络或跨域问题）';
    statusEl.style.background = '#fff3f3';
    statusEl.style.borderColor = '#ffd3d3';
    headersEl.textContent = '-';
    bodyEl.textContent = String(e);
  }
}

function initApiTester() {
  const body = document.getElementById('apiBody');
  if (!body) return;
  body.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      apiSendRequest();
    }
  });
}
