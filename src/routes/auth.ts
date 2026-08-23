import { getSessionUser, generateHex, jsonRes } from '../utils/auth';
export async function renderLogin(env, req) {
    const user = await getSessionUser(env, req);
    if (user) {
        return { redirect: '/' };
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
  <title>登录 - StarLight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .login-container {
      background: #fff;
      border-radius: 12px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #8E44AD;
      text-align: center;
      margin-bottom: 6px;
    }
    .logo-sub {
      text-align: center;
      color: #999;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .form-group { margin-bottom: 18px; }
    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
      background: #fafafa;
    }
    .form-group input:focus {
      outline: none;
      border-color: #8E44AD;
      background: #fff;
    }
    .btn {
      width: 100%;
      padding: 12px;
      background: #8E44AD;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #7d3c98; }
    .register-link {
      text-align: center;
      margin-top: 16px;
      color: #666;
      font-size: 14px;
    }
    .register-link a {
      color: #8E44AD;
      text-decoration: none;
      font-weight: 500;
    }
    .register-link a:hover { text-decoration: underline; }
    .error-msg {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
    .demo-info {
      background: #f5f0f8;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .demo-info strong { color: #8E44AD; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">StarLight</div>
    <div class="logo-sub">登录您的账号</div>
    <div class="demo-info">
      <span><i class="fas fa-info-circle"></i> 管理员</span>
      <span><strong>lin114514</strong></span>
    </div>
    <div id="error-msg" class="error-msg"></div>
    <form id="login-form">
      <div class="form-group">
        <label>用户名</label>
        <input type="text" id="username" placeholder="请输入用户名" required>
      </div>
      <div class="form-group">
        <label>密码</label>
        <input type="password" id="password" placeholder="请输入密码" required>
      </div>
      <button type="submit" class="btn">登录</button>
    </form>
    <div class="register-link">
      还没有账号？ <a href="/register">立即注册</a>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = '/';
        } else {
          const errorEl = document.getElementById('error-msg');
          errorEl.textContent = data.error || '登录失败';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        const errorEl = document.getElementById('error-msg');
        errorEl.textContent = '网络错误，请重试';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

    return { html };
}

export async function renderRegister(env, req) {
    const user = await getSessionUser(env, req);
    if (user) {
        return { redirect: '/' };
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/x-icon" href="https://raw.githubusercontent.com/js-gdo/static/refs/heads/gh-pages/icon/sl/icon.ico">
  <title>注册 - StarLight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .register-container {
      background: #fff;
      border-radius: 12px;
      padding: 48px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #8E44AD;
      text-align: center;
      margin-bottom: 6px;
    }
    .logo-sub {
      text-align: center;
      color: #999;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .form-group { margin-bottom: 18px; }
    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
      background: #fafafa;
    }
    .form-group input:focus {
      outline: none;
      border-color: #8E44AD;
      background: #fff;
    }
    .btn {
      width: 100%;
      padding: 12px;
      background: #8E44AD;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #7d3c98; }
    .login-link {
      text-align: center;
      margin-top: 16px;
      color: #666;
      font-size: 14px;
    }
    .login-link a {
      color: #8E44AD;
      text-decoration: none;
      font-weight: 500;
    }
    .login-link a:hover { text-decoration: underline; }
    .error-msg {
      background: #fee;
      color: #c33;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
    .success-msg {
      background: #efe;
      color: #3c3;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="register-container">
    <div class="logo">StarLight</div>
    <div class="logo-sub">创建新账号</div>
    <div id="error-msg" class="error-msg"></div>
    <div id="success-msg" class="success-msg"></div>
    <form id="register-form">
      <div class="form-group">
        <label>用户名</label>
        <input type="text" id="username" placeholder="3-25个字符" required minlength="3" maxlength="25">
      </div>
      <div class="form-group">
        <label>密码</label>
        <input type="password" id="password" placeholder="至少6个字符" required minlength="6">
      </div>
      <button type="submit" class="btn">注册</button>
    </form>
    <div class="login-link">
      已有账号？ <a href="/login">立即登录</a>
    </div>
  </div>
  <script>
    document.getElementById('register-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          const successEl = document.getElementById('success-msg');
          successEl.textContent = data.message || '注册成功！即将跳转...';
          successEl.style.display = 'block';
          document.getElementById('error-msg').style.display = 'none';
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        } else {
          const errorEl = document.getElementById('error-msg');
          errorEl.textContent = data.error || '注册失败';
          errorEl.style.display = 'block';
          document.getElementById('success-msg').style.display = 'none';
        }
      } catch (err) {
        const errorEl = document.getElementById('error-msg');
        errorEl.textContent = '网络错误，请重试';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;

    return { html };
}