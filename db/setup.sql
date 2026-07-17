-- ================================================
-- Inventory Reservation Service - Database Setup
-- ================================================

CREATE DATABASE IF NOT EXISTS inventory_reservation;
USE inventory_reservation;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'customer') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  total_stock INT NOT NULL DEFAULT 0,
  available_stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_available_stock CHECK (available_stock >= 0),
  CONSTRAINT chk_reserved_stock CHECK (reserved_stock >= 0),
  CONSTRAINT chk_stock_integrity CHECK (available_stock + reserved_stock <= total_stock)
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  status ENUM('pending', 'confirmed', 'expired', 'cancelled') DEFAULT 'pending',
  idempotency_key VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_status_expires (status, expires_at),
  INDEX idx_user_id (user_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  reservation_id VARCHAR(36) UNIQUE NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('completed', 'refunded') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Inventory audit log
CREATE TABLE IF NOT EXISTS inventory_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  reservation_id VARCHAR(36),
  order_id VARCHAR(36),
  action ENUM('reserved', 'released', 'confirmed', 'stock_added', 'stock_adjusted') NOT NULL,
  quantity_changed INT NOT NULL,
  stock_before INT NOT NULL,
  stock_after INT NOT NULL,
  reason VARCHAR(255),
  performed_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_created_at (created_at)
);
