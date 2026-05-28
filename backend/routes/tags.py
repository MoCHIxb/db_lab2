from flask import Blueprint, request, jsonify
from extensions import db
from models import Tag, File, file_tag_table
from utils.auth_helper import require_admin

tags_bp = Blueprint('tags', __name__, url_prefix='/api/tags')


@tags_bp.route('', methods=['GET'])
def list_tags():
    """返回所有标签及其文件数量"""
    tags = Tag.query.all()
    result = []
    for t in tags:
        count = db.session.query(file_tag_table).filter_by(tag_id=t.tag_id).count()
        result.append({'tag_id': t.tag_id, 'tag_name': t.tag_name, 'file_count': count})
    result.sort(key=lambda x: x['file_count'], reverse=True)
    return jsonify(tags=result), 200


@tags_bp.route('/<int:tid>/files', methods=['GET'])
def tag_files(tid):
    """获取特定标签下的所有公开文件"""
    tag = Tag.query.get_or_404(tid)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = (File.query
             .filter(File.tags.contains(tag))
             .filter(File.visibility == 1, File.status == 1)
             .order_by(File.upload_time.desc()))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        tag=tag.to_dict(),
        files=[f.to_dict() for f in pagination.items],
        total=pagination.total,
        page=page,
        pages=pagination.pages,
    ), 200
