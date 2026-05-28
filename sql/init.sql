-- ============================================================
-- 音像云数据库系统  —  MySQL 初始化脚本
-- 运行方式：mysql -u root -p < sql/init.sql
-- 注：建议使用 backend/init_db.py 完成初始化（含管理员账号生成）
-- ============================================================

CREATE DATABASE IF NOT EXISTS media_cloud
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE media_cloud;

-- ── 用户表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user` (
    `user_id`       INT          AUTO_INCREMENT PRIMARY KEY,
    `username`      VARCHAR(50)  NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `email`         VARCHAR(100) NOT NULL UNIQUE,
    `phone`         VARCHAR(20),
    `avatar_url`    VARCHAR(255),
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login`    DATETIME,
    `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '0=禁用 1=正常'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 角色表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `role` (
    `role_id`     INT         AUTO_INCREMENT PRIMARY KEY,
    `role_name`   VARCHAR(30) NOT NULL UNIQUE,
    `description` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 用户-角色关联表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_role` (
    `user_id`     INT      NOT NULL,
    `role_id`     INT      NOT NULL,
    `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `role_id`),
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`role_id`) REFERENCES `role`(`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 权限表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `permission` (
    `permission_id`   INT         AUTO_INCREMENT PRIMARY KEY,
    `permission_name` VARCHAR(50) NOT NULL UNIQUE,
    `resource_type`   VARCHAR(30) NOT NULL,
    `action`          VARCHAR(20) NOT NULL,
    `description`     VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 角色-权限关联表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `role_permission` (
    `role_id`       INT NOT NULL,
    `permission_id` INT NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    FOREIGN KEY (`role_id`)       REFERENCES `role`(`role_id`)             ON DELETE CASCADE,
    FOREIGN KEY (`permission_id`) REFERENCES `permission`(`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 文件表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `file` (
    `file_id`        INT          AUTO_INCREMENT PRIMARY KEY,
    `filename`       VARCHAR(255) NOT NULL COMMENT 'UUID存储名',
    `original_name`  VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `file_type`      VARCHAR(20)  NOT NULL COMMENT 'audio / video',
    `file_ext`       VARCHAR(10)  NOT NULL,
    `file_size`      BIGINT       NOT NULL COMMENT '字节数',
    `storage_path`   VARCHAR(500) NOT NULL,
    `cover_url`      VARCHAR(500),
    `description`    TEXT,
    `uploader_id`    INT          NOT NULL,
    `upload_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `visibility`     TINYINT      NOT NULL DEFAULT 1  COMMENT '0=私有 1=公开 2=授权可见',
    `status`         TINYINT      NOT NULL DEFAULT 1  COMMENT '0=已删除 1=正常',
    `download_count` INT          NOT NULL DEFAULT 0,
    `view_count`     INT          NOT NULL DEFAULT 0,
    FOREIGN KEY (`uploader_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_uploader`         (`uploader_id`),
    INDEX `idx_visibility_status`(`visibility`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 分类表（自引用，支持多级） ──────────────────────────────
CREATE TABLE IF NOT EXISTS `category` (
    `category_id`   INT         AUTO_INCREMENT PRIMARY KEY,
    `category_name` VARCHAR(50) NOT NULL,
    `parent_id`     INT         DEFAULT NULL,
    `sort_order`    INT         NOT NULL DEFAULT 0,
    FOREIGN KEY (`parent_id`) REFERENCES `category`(`category_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 文件-分类关联表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `file_category` (
    `file_id`     INT NOT NULL,
    `category_id` INT NOT NULL,
    PRIMARY KEY (`file_id`, `category_id`),
    FOREIGN KEY (`file_id`)     REFERENCES `file`(`file_id`)         ON DELETE CASCADE,
    FOREIGN KEY (`category_id`) REFERENCES `category`(`category_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 标签表 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tag` (
    `tag_id`   INT         AUTO_INCREMENT PRIMARY KEY,
    `tag_name` VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 文件-标签关联表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `file_tag` (
    `file_id` INT NOT NULL,
    `tag_id`  INT NOT NULL,
    PRIMARY KEY (`file_id`, `tag_id`),
    FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE CASCADE,
    FOREIGN KEY (`tag_id`)  REFERENCES `tag`(`tag_id`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 文件授权表（文件级用户权限） ────────────────────────────
CREATE TABLE IF NOT EXISTS `file_permission` (
    `fp_id`           INT         AUTO_INCREMENT PRIMARY KEY,
    `file_id`         INT         NOT NULL,
    `user_id`         INT         NOT NULL,
    `permission_type` VARCHAR(20) NOT NULL COMMENT 'read / download',
    `granted_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expire_at`       DATETIME             DEFAULT NULL COMMENT 'NULL=永久',
    UNIQUE KEY `uq_file_user` (`file_id`, `user_id`),
    FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 分享记录表 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `share` (
    `share_id`     INT         AUTO_INCREMENT PRIMARY KEY,
    `file_id`      INT         NOT NULL,
    `sharer_id`    INT         NOT NULL,
    `share_code`   VARCHAR(10) NOT NULL UNIQUE,
    `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expire_at`    DATETIME             DEFAULT NULL COMMENT 'NULL=永久',
    `access_limit` INT         NOT NULL DEFAULT 0 COMMENT '0=不限',
    `access_count` INT         NOT NULL DEFAULT 0,
    `status`       TINYINT     NOT NULL DEFAULT 1 COMMENT '0=已吊销 1=有效',
    INDEX `idx_share_code` (`share_code`),
    FOREIGN KEY (`file_id`)   REFERENCES `file`(`file_id`) ON DELETE CASCADE,
    FOREIGN KEY (`sharer_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 访问日志表 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `access_log` (
    `log_id`      INT          AUTO_INCREMENT PRIMARY KEY,
    `user_id`     INT                   DEFAULT NULL COMMENT 'NULL=匿名访问',
    `file_id`     INT          NOT NULL,
    `action`      VARCHAR(20)  NOT NULL COMMENT 'view/download/share_access/upload',
    `access_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ip_address`  VARCHAR(45),
    `user_agent`  VARCHAR(200),
    INDEX `idx_log_user` (`user_id`),
    INDEX `idx_log_file` (`file_id`),
    INDEX `idx_log_time` (`access_time`),
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE SET NULL,
    FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
