"""
init_db.py  —  一键初始化数据库
用法:
    cd backend
    python init_db.py
"""
import sys
import os

# 将 backend 目录加入 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bcrypt
from app import create_app
from extensions import db
from models import User, Role, Permission, Category


ROLES = [
    {'role_name': 'admin', 'description': '系统管理员，拥有所有权限'},
    {'role_name': 'user',  'description': '普通用户，可管理自己的文件'},
]

PERMISSIONS = [
    ('file:read',       'file',     'read',        '查看文件列表和详情'),
    ('file:upload',     'file',     'upload',       '上传文件'),
    ('file:download',   'file',     'download',     '下载文件'),
    ('file:delete_own', 'file',     'delete_own',   '删除自己上传的文件'),
    ('file:delete_any', 'file',     'delete_any',   '删除任意文件（管理员）'),
    ('file:edit_own',   'file',     'edit_own',     '编辑自己的文件信息'),
    ('file:edit_any',   'file',     'edit_any',     '编辑任意文件信息（管理员）'),
    ('category:read',   'category', 'read',         '查看分类'),
    ('category:write',  'category', 'write',        '管理分类（管理员）'),
    ('user:manage',     'user',     'manage',       '管理用户账户（管理员）'),
    ('log:read_own',    'log',      'read_own',     '查看自己的访问记录'),
    ('log:read_any',    'log',      'read_any',     '查看所有访问记录（管理员）'),
]

# 管理员专属权限名称
ADMIN_ONLY = {'file:delete_any', 'file:edit_any', 'category:write', 'user:manage', 'log:read_any'}

ROOT_CATEGORIES = [
    ('音乐', 1), ('视频', 2), ('有声书', 3), ('其他', 4),
]
SUB_CATEGORIES = {
    '音乐': [('流行', 1), ('古典', 2), ('摇滚', 3), ('电影原声', 4)],
    '视频': [('电影', 1), ('电视剧', 2), ('纪录片', 3), ('教学视频', 4)],
}

ADMIN_PASSWORD = 'Admin@123'


def init():
    app = create_app()
    with app.app_context():
        print('创建数据表...')
        db.create_all()

        # 角色
        role_objects = {}
        for rd in ROLES:
            r = Role.query.filter_by(role_name=rd['role_name']).first()
            if not r:
                r = Role(**rd)
                db.session.add(r)
                db.session.flush()
                print(f'  创建角色: {r.role_name}')
            role_objects[r.role_name] = r

        # 权限
        perm_objects = {}
        for pname, rtype, act, desc in PERMISSIONS:
            p = Permission.query.filter_by(permission_name=pname).first()
            if not p:
                p = Permission(permission_name=pname, resource_type=rtype, action=act, description=desc)
                db.session.add(p)
                db.session.flush()
                print(f'  创建权限: {pname}')
            perm_objects[pname] = p

        # 角色-权限绑定
        admin_role = role_objects['admin']
        user_role  = role_objects['user']
        for pname, p in perm_objects.items():
            if p not in admin_role.permissions:
                admin_role.permissions.append(p)
            if pname not in ADMIN_ONLY and p not in user_role.permissions:
                user_role.permissions.append(p)

        # 管理员账号
        if not User.query.filter_by(username='admin').first():
            pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin = User(username='admin', password_hash=pw_hash,
                         email='admin@mediacloud.com', status=1)
            admin.roles.append(admin_role)
            db.session.add(admin)
            print(f'  创建管理员账号: admin / {ADMIN_PASSWORD}')

        # 初始分类
        cat_map = {}
        for name, order in ROOT_CATEGORIES:
            c = Category.query.filter_by(category_name=name, parent_id=None).first()
            if not c:
                c = Category(category_name=name, sort_order=order)
                db.session.add(c)
                db.session.flush()
                print(f'  创建分类: {name}')
            cat_map[name] = c

        for parent_name, children in SUB_CATEGORIES.items():
            parent = cat_map.get(parent_name)
            if not parent:
                continue
            for name, order in children:
                if not Category.query.filter_by(category_name=name, parent_id=parent.category_id).first():
                    c = Category(category_name=name, parent_id=parent.category_id, sort_order=order)
                    db.session.add(c)
                    print(f'  创建子分类: {parent_name} > {name}')

        db.session.commit()
        print('\n初始化完成！')
        print(f'管理员账号: admin  密码: {ADMIN_PASSWORD}')
        print('请在生产环境登录后立即修改默认密码。')


if __name__ == '__main__':
    init()
