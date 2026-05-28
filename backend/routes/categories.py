from flask import Blueprint, request, jsonify
from extensions import db
from models import Category
from utils.auth_helper import require_auth, require_admin

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


@categories_bp.route('', methods=['GET'])
def list_categories():
    """返回完整分类树（顶级节点 + 子节点）"""
    roots = Category.query.filter_by(parent_id=None).order_by(Category.sort_order).all()
    return jsonify(categories=[c.to_dict(include_children=True) for c in roots]), 200


@categories_bp.route('', methods=['POST'])
@require_admin
def create_category():
    data = request.get_json() or {}
    name = (data.get('category_name') or '').strip()
    if not name:
        return jsonify(msg='分类名不能为空'), 400

    parent_id = data.get('parent_id')
    if parent_id and not Category.query.get(parent_id):
        return jsonify(msg='父分类不存在'), 404

    cat = Category(
        category_name=name,
        parent_id=parent_id,
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(msg='分类已创建', category=cat.to_dict()), 201


@categories_bp.route('/<int:cid>', methods=['PUT'])
@require_admin
def update_category(cid):
    cat = Category.query.get_or_404(cid)
    data = request.get_json() or {}

    if 'category_name' in data:
        cat.category_name = data['category_name'].strip() or cat.category_name
    if 'parent_id' in data:
        pid = data['parent_id']
        if pid and not Category.query.get(pid):
            return jsonify(msg='父分类不存在'), 404
        cat.parent_id = pid
    if 'sort_order' in data:
        cat.sort_order = int(data['sort_order'])

    db.session.commit()
    return jsonify(msg='分类已更新', category=cat.to_dict()), 200


@categories_bp.route('/<int:cid>', methods=['DELETE'])
@require_admin
def delete_category(cid):
    cat = Category.query.get_or_404(cid)
    db.session.delete(cat)
    db.session.commit()
    return jsonify(msg='分类已删除'), 200
