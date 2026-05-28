# 音像云数据库系统（MediaCloud）

本项目是一个用于音频/视频文件存取与权限控制的课程设计实现，采用 B/S 架构，后端使用 Python Flask，数据库平台为 MySQL，数据库模式满足 3NF 设计。

## 1. 项目目标

实现一个可运行的数据库应用，包含：
- 多账户登录与角色区分（admin / user）
- 音像文件上传、浏览、在线播放、下载
- 文件可见性控制（公开/私有/授权）
- 文件级授权、分享链接、访问日志审计
- 管理后台（用户、文件、分类、日志）

## 2. 技术栈

- 前端：HTML + CSS + JavaScript（单页界面）
- 后端：Flask + SQLAlchemy + JWT
- 数据库：MySQL 8+
- 鉴权：JWT + bcrypt

## 3. 目录结构

```text
.
├─ backend/
│  ├─ app.py
│  ├─ init_db.py
│  ├─ config.py
│  ├─ models.py
│  ├─ requirements.txt
│  ├─ routes/
│  └─ utils/
├─ frontend/
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/
├─ sql/
│  └─ init.sql
├─ lab2_er.md
├─ DEPLOY_GUIDE.txt
└─ README.md
```

## 4. 环境要求

- Python 3.10 或更高版本
- MySQL 8.0 或更高版本
- pip 可用

## 5. 快速启动（本地/服务器通用）

### 5.1 进入后端目录

```bash
cd backend
```

### 5.2 创建虚拟环境并安装依赖

Linux/macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 5.3 配置环境变量

Linux/macOS:

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASS='your_password'
export DB_NAME=media_cloud
export SECRET_KEY='change_me'
export JWT_SECRET_KEY='change_me_too'
```

Windows PowerShell:

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_USER='root'
$env:DB_PASS='your_password'
$env:DB_NAME='media_cloud'
$env:SECRET_KEY='change_me'
$env:JWT_SECRET_KEY='change_me_too'
```

### 5.4 初始化数据库

推荐方式（自动建表 + 初始化角色权限 + 创建管理员）：

```bash
python init_db.py
```

可选方式（仅建表）：

```bash
mysql -u root -p < ../sql/init.sql
```

### 5.5 启动服务

```bash
python app.py
```

默认启动地址：

- http://127.0.0.1:5000
- http://服务器IP:5000

## 6. 默认管理员账号（使用 init_db.py 时）

- 用户名：admin
- 密码：Admin@123

首次登录后请立即修改默认密码。

## 7. 启动后功能测试指令

以下命令用于快速验证服务是否可用。

### 7.1 健康检查（页面可访问）

```bash
curl -i http://127.0.0.1:5000/
```

### 7.2 注册普通用户

```bash
curl -X POST http://127.0.0.1:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"u1","email":"u1@example.com","password":"123456"}'
```

### 7.3 登录获取 JWT

```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"u1","password":"123456"}'
```

将返回的 token 保存为环境变量 TOKEN。

Linux/macOS:

```bash
export TOKEN='替换为登录返回的token'
```

Windows PowerShell:

```powershell
$env:TOKEN='替换为登录返回的token'
```

### 7.4 查询个人信息（验证鉴权）

```bash
curl http://127.0.0.1:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

Windows PowerShell:

```powershell
curl http://127.0.0.1:5000/api/auth/profile -H "Authorization: Bearer $env:TOKEN"
```

### 7.5 上传文件（示例）

Linux/macOS:

```bash
curl -X POST http://127.0.0.1:5000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/demo.mp3" \
  -F "visibility=1" \
  -F "description=test file" \
  -F "tags=测试,音频"
```

Windows PowerShell:

```powershell
curl -Method POST http://127.0.0.1:5000/api/files/upload `
  -Headers @{ Authorization = "Bearer $env:TOKEN" } `
  -Form @{ file = Get-Item "C:\path\to\demo.mp3"; visibility = "1"; description = "test file"; tags = "测试,音频" }
```

### 7.6 查询公开文件列表

```bash
curl "http://127.0.0.1:5000/api/files?page=1&per_page=10"
```

### 7.7 创建分享链接（示例 file_id=1）

```bash
curl -X POST http://127.0.0.1:5000/api/shares \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_id":1,"access_limit":10}'
```

### 7.8 获取访问日志（管理员）

```bash
curl "http://127.0.0.1:5000/api/logs?page=1&per_page=10" \
  -H "Authorization: Bearer $TOKEN"
```

## 8. 常见问题

1. 报错 "数据库连接失败"
- 检查 MySQL 服务是否启动
- 检查 DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME 是否正确

2. 上传失败或 413
- 检查文件大小是否超过配置上限（默认 2GB）
- 检查 backend/uploads 目录写权限

3. 登录后接口仍 401/403
- 确认请求头 Authorization 是否为 Bearer Token 格式
- 确认 token 未过期

4. 页面能打开但接口 404
- 确认是通过 app.py 启动（非直接打开 html）
- 确认访问路径是 /api/... 而不是错误的相对路径

## 9. 课程设计文档

- 需求分析与 ER 图：lab2_er.md
- 数据库 SQL 初始化脚本：sql/init.sql
- 云服务器部署补充说明：DEPLOY_GUIDE.txt

