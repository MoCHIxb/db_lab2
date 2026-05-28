from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity
import bcrypt
from datetime import datetime
from extensions import db
from models import User, Role
from utils.auth_helper import require_auth, get_current_user

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify(msg='缺少请求体'), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    email    = (data.get('email') or '').strip()

    if not username or not password or not email:
        return jsonify(msg='用户名、密码和邮箱不能为空'), 400
    if len(username) < 3 or len(username) > 50:
        return jsonify(msg='用户名长度需在 3~50 个字符之间'), 400
    if len(password) < 6:
        return jsonify(msg='密码不能少于 6 个字符'), 400

    if User.query.filter_by(username=username).first():
        return jsonify(msg='用户名已存在'), 409
    if User.query.filter_by(email=email).first():
        return jsonify(msg='邮箱已被注册'), 409

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, password_hash=pw_hash, email=email)
    # 默认赋予 user 角色
    user_role = Role.query.filter_by(role_name='user').first()
    if user_role:
        user.roles.append(user_role)
    db.session.add(user)
    db.session.commit()
    return jsonify(msg='注册成功', user_id=user.user_id), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify(msg='缺少请求体'), 400

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify(msg='用户名或密码错误'), 401
    if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify(msg='用户名或密码错误'), 401
    if user.status == 0:
        return jsonify(msg='账号已被禁用，请联系管理员'), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    token = create_access_token(identity=user.user_id)
    return jsonify(token=token, user=user.to_dict()), 200


@auth_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    user = get_current_user()
    return jsonify(user=user.to_dict()), 200


@auth_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    user = get_current_user()
    data = request.get_json() or {}

    if 'email' in data:
        email = data['email'].strip()
        existing = User.query.filter_by(email=email).first()
        if existing and existing.user_id != user.user_id:
            return jsonify(msg='邮箱已被使用'), 409
        user.email = email
    if 'phone' in data:
        user.phone = data['phone'].strip() or None
    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url'].strip() or None

    db.session.commit()
    return jsonify(msg='个人资料已更新', user=user.to_dict()), 200


@auth_bp.route('/password', methods=['PUT'])
@require_auth
def change_password():
    user = get_current_user()
    data = request.get_json() or {}

    old_pw  = data.get('old_password') or ''
    new_pw  = data.get('new_password') or ''

    if not old_pw or not new_pw:
        return jsonify(msg='旧密码和新密码不能为空'), 400
    if len(new_pw) < 6:
        return jsonify(msg='新密码不能少于 6 个字符'), 400
    if not bcrypt.checkpw(old_pw.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify(msg='旧密码错误'), 401

    user.password_hash = bcrypt.hashpw(new_pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.session.commit()
    return jsonify(msg='密码已修改'), 200
