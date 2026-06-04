import random
import string
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from extensions import db
from models import Share, File
from utils.auth_helper import require_auth, get_current_user, log_access

shares_bp = Blueprint('shares', __name__, url_prefix='/api/shares')


def _generate_code(length=6) -> str:
    chars = string.ascii_letters + string.digits
    while True:
        code = ''.join(random.choices(chars, k=length))
        if not Share.query.filter_by(share_code=code).first():
            return code


def _parse_expire_at(value: str):
    """兼容多种前端时间格式：
    - 2026-06-04T12:30
    - 2026-06-04T12:30:00
    - 2026-06-04T12:30:00Z
    - 2026-06-04T12:30:00+08:00
    """
    if not value:
        return None

    text = value.strip()
    if not text:
        return None

    # Python 的 fromisoformat 在部分版本不接受末尾 Z，统一转成 +00:00
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'

    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass

    # 兜底兼容常见 datetime-local 字符串
    for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


@shares_bp.route('', methods=['POST'])
@require_auth
def create_share():
    user = get_current_user()
    data = request.get_json() or {}

    file_id = data.get('file_id')
    if not file_id:
        return jsonify(msg='缺少 file_id'), 400

    file = File.query.get(file_id)
    if not file or file.status != 1:
        return jsonify(msg='文件不存在'), 404
    if file.uploader_id != user.user_id and not user.has_role('admin'):
        return jsonify(msg='只能分享自己的文件'), 403

    expire_at = None
    if data.get('expire_at'):
        expire_at = _parse_expire_at(str(data['expire_at']))
        if expire_at is None:
            return jsonify(msg='expire_at 格式错误，请使用 ISO 8601'), 400

    share = Share(
        file_id=file_id,
        sharer_id=user.user_id,
        share_code=_generate_code(),
        expire_at=expire_at,
        access_limit=int(data.get('access_limit', 0)),
    )
    db.session.add(share)
    db.session.commit()
    return jsonify(msg='分享链接已创建', share=share.to_dict()), 201


@shares_bp.route('/my', methods=['GET'])
@require_auth
def my_shares():
    user = get_current_user()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    pagination = (Share.query
                  .filter_by(sharer_id=user.user_id)
                  .order_by(Share.created_at.desc())
                  .paginate(page=page, per_page=per_page, error_out=False))
    return jsonify(
        shares=[s.to_dict() for s in pagination.items],
        total=pagination.total,
        page=page,
        pages=pagination.pages,
    ), 200


@shares_bp.route('/access/<string:code>', methods=['GET'])
def access_by_code(code):
    """通过分享码获取文件信息（无需登录）"""
    share = Share.query.filter_by(share_code=code).first()
    if not share or not share.is_valid():
        return jsonify(msg='分享链接无效或已过期'), 404

    share.access_count += 1
    db.session.commit()

    user = get_current_user()
    log_access(share.file_id, user.user_id if user else None, 'share_access')

    return jsonify(share=share.to_dict(), file=share.file.to_dict()), 200


@shares_bp.route('/<int:sid>', methods=['DELETE'])
@require_auth
def revoke_share(sid):
    user = get_current_user()
    share = Share.query.get_or_404(sid)
    if share.sharer_id != user.user_id and not user.has_role('admin'):
        return jsonify(msg='无权操作'), 403
    share.status = 0
    db.session.commit()
    return jsonify(msg='分享已吊销'), 200
