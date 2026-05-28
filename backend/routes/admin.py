from flask import Blueprint, request, jsonify
from sqlalchemy import func
from extensions import db
from models import User, File, Role, AccessLog, Share
from utils.auth_helper import require_admin, get_current_user
import bcrypt

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.route('/stats', methods=['GET'])
@require_admin
def dashboard_stats():
    user_count  = User.query.count()
    file_count  = File.query.filter_by(status=1).count()
    share_count = Share.query.count()
    log_count   = AccessLog.query.count()
    total_size  = db.session.query(func.sum(File.file_size)).filter_by(status=1).scalar() or 0
    return jsonify(
        user_count=user_count,
        file_count=file_count,
        share_count=share_count,
        log_count=log_count,
        total_size=total_size,
    ), 200


@admin_bp.route('/users', methods=['GET'])
@require_admin
def list_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    keyword = request.args.get('keyword', '').strip()

    query = User.query
    if keyword:
        query = query.filter(
            (User.username.like(f'%{keyword}%')) | (User.email.like(f'%{keyword}%'))
        )
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False)
    return jsonify(
        users=[u.to_dict() for u in pagination.items],
        total=pagination.total,
        page=page,
        pages=pagination.pages,
    ), 200


@admin_bp.route('/users/<int:uid>/status', methods=['PUT'])
@require_admin
def toggle_user_status(uid):
    me = get_current_user()
    if uid == me.user_id:
        return jsonify(msg='不能修改自己的状态'), 400
    user = User.query.get_or_404(uid)
    user.status = 0 if user.status == 1 else 1
    db.session.commit()
    return jsonify(msg='状态已更新', status=user.status), 200


@admin_bp.route('/users/<int:uid>/role', methods=['PUT'])
@require_admin
def set_user_role(uid):
    user = User.query.get_or_404(uid)
    data = request.get_json() or {}
    role_name = data.get('role_name')
    role = Role.query.filter_by(role_name=role_name).first()
    if not role:
        return jsonify(msg='角色不存在'), 404
    user.roles = [role]
    db.session.commit()
    return jsonify(msg='角色已更新', user=user.to_dict()), 200


@admin_bp.route('/users', methods=['POST'])
@require_admin
def create_user():
    """管理员手动创建用户"""
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    email    = (data.get('email') or '').strip()
    role_name = data.get('role', 'user')

    if not username or not password or not email:
        return jsonify(msg='用户名、密码和邮箱不能为空'), 400
    if User.query.filter_by(username=username).first():
        return jsonify(msg='用户名已存在'), 409
    if User.query.filter_by(email=email).first():
        return jsonify(msg='邮箱已被注册'), 409

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, password_hash=pw_hash, email=email)
    role = Role.query.filter_by(role_name=role_name).first()
    if role:
        user.roles.append(role)
    db.session.add(user)
    db.session.commit()
    return jsonify(msg='用户已创建', user=user.to_dict()), 201


@admin_bp.route('/files', methods=['GET'])
@require_admin
def list_all_files():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    keyword = request.args.get('keyword', '').strip()

    query = File.query.filter_by(status=1)
    if keyword:
        query = query.filter(File.original_name.like(f'%{keyword}%'))
    pagination = query.order_by(File.upload_time.desc()).paginate(
        page=page, per_page=per_page, error_out=False)
    return jsonify(
        files=[f.to_dict() for f in pagination.items],
        total=pagination.total,
        page=page,
        pages=pagination.pages,
    ), 200
