from datetime import datetime
from extensions import db


# ── 多对多关联中间表 ───────────────────────────────────────────────────────────

user_role_table = db.Table(
    'user_role',
    db.Column('user_id', db.Integer, db.ForeignKey('user.user_id', ondelete='CASCADE'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('role.role_id', ondelete='CASCADE'), primary_key=True),
    db.Column('assigned_at', db.DateTime, default=datetime.utcnow),
)

role_permission_table = db.Table(
    'role_permission',
    db.Column('role_id', db.Integer, db.ForeignKey('role.role_id', ondelete='CASCADE'), primary_key=True),
    db.Column('permission_id', db.Integer, db.ForeignKey('permission.permission_id', ondelete='CASCADE'), primary_key=True),
)

file_category_table = db.Table(
    'file_category',
    db.Column('file_id', db.Integer, db.ForeignKey('file.file_id', ondelete='CASCADE'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('category.category_id', ondelete='CASCADE'), primary_key=True),
)

file_tag_table = db.Table(
    'file_tag',
    db.Column('file_id', db.Integer, db.ForeignKey('file.file_id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.tag_id', ondelete='CASCADE'), primary_key=True),
)


# ── 实体表 ───────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'user'

    user_id      = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username     = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email        = db.Column(db.String(100), unique=True, nullable=False)
    phone        = db.Column(db.String(20))
    avatar_url   = db.Column(db.String(255))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    last_login   = db.Column(db.DateTime)
    status       = db.Column(db.SmallInteger, default=1)   # 0=禁用 1=正常

    roles            = db.relationship('Role', secondary=user_role_table, back_populates='users', lazy='select')
    files            = db.relationship('File', back_populates='uploader', lazy='dynamic')
    file_permissions = db.relationship('FilePermission', back_populates='user', lazy='dynamic')
    shares           = db.relationship('Share', back_populates='sharer', lazy='dynamic')
    access_logs      = db.relationship('AccessLog', back_populates='user', lazy='dynamic')

    def has_role(self, role_name: str) -> bool:
        return any(r.role_name == role_name for r in self.roles)

    def to_dict(self):
        return {
            'user_id':    self.user_id,
            'username':   self.username,
            'email':      self.email,
            'phone':      self.phone,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'status':     self.status,
            'roles':      [r.role_name for r in self.roles],
        }


class Role(db.Model):
    __tablename__ = 'role'

    role_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_name   = db.Column(db.String(30), unique=True, nullable=False)
    description = db.Column(db.String(100))

    users       = db.relationship('User', secondary=user_role_table, back_populates='roles')
    permissions = db.relationship('Permission', secondary=role_permission_table, back_populates='roles')

    def to_dict(self):
        return {'role_id': self.role_id, 'role_name': self.role_name, 'description': self.description}


class Permission(db.Model):
    __tablename__ = 'permission'

    permission_id   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    permission_name = db.Column(db.String(50), unique=True, nullable=False)
    resource_type   = db.Column(db.String(30), nullable=False)
    action          = db.Column(db.String(20), nullable=False)
    description     = db.Column(db.String(100))

    roles = db.relationship('Role', secondary=role_permission_table, back_populates='permissions')


class File(db.Model):
    __tablename__ = 'file'

    file_id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename      = db.Column(db.String(255), nullable=False)          # UUID存储名
    original_name = db.Column(db.String(255), nullable=False)          # 原始文件名
    file_type     = db.Column(db.String(20), nullable=False)           # audio / video
    file_ext      = db.Column(db.String(10), nullable=False)
    file_size     = db.Column(db.BigInteger, nullable=False)
    storage_path  = db.Column(db.String(500), nullable=False)
    cover_url     = db.Column(db.String(500))
    description   = db.Column(db.Text)
    uploader_id   = db.Column(db.Integer, db.ForeignKey('user.user_id', ondelete='CASCADE'), nullable=False)
    upload_time   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    visibility    = db.Column(db.SmallInteger, default=1)  # 0=私有 1=公开 2=授权可见
    status        = db.Column(db.SmallInteger, default=1)  # 0=已删除 1=正常
    download_count = db.Column(db.Integer, default=0)
    view_count    = db.Column(db.Integer, default=0)

    uploader    = db.relationship('User', back_populates='files')
    categories  = db.relationship('Category', secondary=file_category_table, back_populates='files')
    tags        = db.relationship('Tag', secondary=file_tag_table, back_populates='files')
    permissions = db.relationship('FilePermission', back_populates='file', cascade='all, delete-orphan')
    shares      = db.relationship('Share', back_populates='file', cascade='all, delete-orphan')
    access_logs = db.relationship('AccessLog', back_populates='file', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'file_id':       self.file_id,
            'original_name': self.original_name,
            'file_type':     self.file_type,
            'file_ext':      self.file_ext,
            'file_size':     self.file_size,
            'cover_url':     self.cover_url,
            'description':   self.description,
            'uploader_id':   self.uploader_id,
            'uploader_name': self.uploader.username if self.uploader else None,
            'upload_time':   self.upload_time.isoformat() if self.upload_time else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
            'visibility':    self.visibility,
            'status':        self.status,
            'download_count': self.download_count,
            'view_count':    self.view_count,
            'categories':    [{'id': c.category_id, 'name': c.category_name} for c in self.categories],
            'tags':          [{'id': t.tag_id, 'name': t.tag_name} for t in self.tags],
        }


class Category(db.Model):
    __tablename__ = 'category'

    category_id   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category_name = db.Column(db.String(50), nullable=False)
    parent_id     = db.Column(db.Integer, db.ForeignKey('category.category_id', ondelete='SET NULL'), nullable=True)
    sort_order    = db.Column(db.Integer, default=0)

    children = db.relationship('Category', backref=db.backref('parent', remote_side='Category.category_id'), lazy='select')
    files    = db.relationship('File', secondary=file_category_table, back_populates='categories')

    def to_dict(self, include_children=False):
        d = {
            'category_id':   self.category_id,
            'category_name': self.category_name,
            'parent_id':     self.parent_id,
            'sort_order':    self.sort_order,
        }
        if include_children:
            d['children'] = [c.to_dict(include_children=True)
                             for c in sorted(self.children, key=lambda x: x.sort_order)]
        return d


class Tag(db.Model):
    __tablename__ = 'tag'

    tag_id   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tag_name = db.Column(db.String(30), unique=True, nullable=False)

    files = db.relationship('File', secondary=file_tag_table, back_populates='tags')

    def to_dict(self):
        return {'tag_id': self.tag_id, 'tag_name': self.tag_name}


class FilePermission(db.Model):
    __tablename__ = 'file_permission'
    __table_args__ = (db.UniqueConstraint('file_id', 'user_id', name='uq_file_user'),)

    fp_id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id         = db.Column(db.Integer, db.ForeignKey('file.file_id', ondelete='CASCADE'), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey('user.user_id', ondelete='CASCADE'), nullable=False)
    permission_type = db.Column(db.String(20), nullable=False)  # read / download
    granted_at      = db.Column(db.DateTime, default=datetime.utcnow)
    expire_at       = db.Column(db.DateTime, nullable=True)     # NULL = 永久

    file = db.relationship('File', back_populates='permissions')
    user = db.relationship('User', back_populates='file_permissions')

    def is_valid(self) -> bool:
        if self.expire_at is None:
            return True
        return datetime.utcnow() < self.expire_at

    def to_dict(self):
        return {
            'fp_id':           self.fp_id,
            'file_id':         self.file_id,
            'user_id':         self.user_id,
            'username':        self.user.username if self.user else None,
            'permission_type': self.permission_type,
            'granted_at':      self.granted_at.isoformat() if self.granted_at else None,
            'expire_at':       self.expire_at.isoformat() if self.expire_at else None,
        }


class Share(db.Model):
    __tablename__ = 'share'

    share_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_id      = db.Column(db.Integer, db.ForeignKey('file.file_id', ondelete='CASCADE'), nullable=False)
    sharer_id    = db.Column(db.Integer, db.ForeignKey('user.user_id', ondelete='CASCADE'), nullable=False)
    share_code   = db.Column(db.String(10), unique=True, nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    expire_at    = db.Column(db.DateTime, nullable=True)    # NULL = 永久
    access_limit = db.Column(db.Integer, default=0)         # 0 = 不限
    access_count = db.Column(db.Integer, default=0)
    status       = db.Column(db.SmallInteger, default=1)    # 0=已吊销 1=有效

    file   = db.relationship('File', back_populates='shares')
    sharer = db.relationship('User', back_populates='shares')

    def is_valid(self) -> bool:
        if self.status != 1:
            return False
        if self.expire_at and datetime.utcnow() > self.expire_at:
            return False
        if self.access_limit > 0 and self.access_count >= self.access_limit:
            return False
        return True

    def to_dict(self):
        return {
            'share_id':     self.share_id,
            'file_id':      self.file_id,
            'file_name':    self.file.original_name if self.file else None,
            'file_type':    self.file.file_type if self.file else None,
            'sharer_id':    self.sharer_id,
            'sharer_name':  self.sharer.username if self.sharer else None,
            'share_code':   self.share_code,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
            'expire_at':    self.expire_at.isoformat() if self.expire_at else None,
            'access_limit': self.access_limit,
            'access_count': self.access_count,
            'status':       self.status,
        }


class AccessLog(db.Model):
    __tablename__ = 'access_log'

    log_id      = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('user.user_id', ondelete='SET NULL'), nullable=True)
    file_id     = db.Column(db.Integer, db.ForeignKey('file.file_id', ondelete='CASCADE'), nullable=False)
    action      = db.Column(db.String(20), nullable=False)  # view/download/share/upload
    access_time = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address  = db.Column(db.String(45))
    user_agent  = db.Column(db.String(200))

    user = db.relationship('User', back_populates='access_logs')
    file = db.relationship('File', back_populates='access_logs')

    def to_dict(self):
        return {
            'log_id':      self.log_id,
            'user_id':     self.user_id,
            'username':    self.user.username if self.user else '匿名用户',
            'file_id':     self.file_id,
            'file_name':   self.file.original_name if self.file else None,
            'action':      self.action,
            'access_time': self.access_time.isoformat() if self.access_time else None,
            'ip_address':  self.ip_address,
            'user_agent':  self.user_agent,
        }
