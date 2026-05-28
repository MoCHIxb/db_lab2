from flask import Blueprint, request, jsonify
from extensions import db
from models import AccessLog, File
from utils.auth_helper import require_auth, require_admin, get_current_user

logs_bp = Blueprint('logs', __name__, url_prefix='/api/logs')


@logs_bp.route('', methods=['GET'])
@require_auth
def get_logs():
    user = get_current_user()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)

    query = AccessLog.query
    if not user.has_role('admin'):
        # 普通用户只能查看自己的日志
        query = query.filter_by(user_id=user.user_id)
    else:
        # 管理员支持按用户/文件过滤
        if request.args.get('user_id'):
            query = query.filter_by(user_id=request.args.get('user_id', type=int))
        if request.args.get('file_id'):
            query = query.filter_by(file_id=request.args.get('file_id', type=int))

    if request.args.get('action'):
        query = query.filter_by(action=request.args['action'])

    pagination = query.order_by(AccessLog.access_time.desc()).paginate(
        page=page, per_page=per_page, error_out=False)

    return jsonify(
        logs=[l.to_dict() for l in pagination.items],
        total=pagination.total,
        page=page,
        pages=pagination.pages,
    ), 200


@logs_bp.route('/stats', methods=['GET'])
@require_admin
def stats():
    """简单统计：各操作类型的日志数量"""
    from sqlalchemy import func
    rows = db.session.query(AccessLog.action, func.count(AccessLog.log_id)).group_by(AccessLog.action).all()
    return jsonify(stats={action: count for action, count in rows}), 200
