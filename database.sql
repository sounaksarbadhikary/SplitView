CREATE DATABASE IF NOT EXISTS splitflow_db;
USE splitflow_db;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS groups_table (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_members (
  group_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT fk_members_group FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  paid_by INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'Other',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_group FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_payer FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_expenses_group_created (group_id, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO users (id, name, email, password_hash) VALUES
  (1, 'Aarav Mehta', 'aarav@splitflow.demo', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  (2, 'Maya Chen', 'maya@splitflow.demo', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
INSERT IGNORE INTO users (name, email, password_hash) VALUES
  ('SplitFlow Demo', 'demo@splitflow.demo', '$2a$12$ZpA7HGO1ry4Qv6cUYzshTOoVcuaB.s4.6yYOQ9B4nqavGuoHVsryq');
INSERT IGNORE INTO groups_table (id, name, invite_code, created_by) VALUES (1, 'Weekend in Goa', 'GOA24X', 1);
INSERT IGNORE INTO group_members (group_id, user_id) VALUES (1, 1), (1, 2);
INSERT IGNORE INTO expenses (id, group_id, paid_by, title, amount, category, created_at) VALUES
  (1, 1, 1, 'Villa booking', 18400.00, 'Stay', '2026-08-22 10:30:00'),
  (2, 1, 2, 'Airport transfers', 2450.00, 'Travel', '2026-08-23 08:15:00');
