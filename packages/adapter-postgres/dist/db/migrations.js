"use strict";
// ============================================================================
// SQL MIGRATIONS
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIGRATIONS = void 0;
exports.MIGRATIONS = {
    notifications: (tablePrefix) => `
    CREATE TABLE IF NOT EXISTS ${tablePrefix}notifications (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      
      user_id VARCHAR(255) NOT NULL,
      group_id VARCHAR(255),
      
      priority VARCHAR(20) NOT NULL,
      category VARCHAR(100),
      
      status VARCHAR(20) NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      scheduled_for TIMESTAMP,
      expires_at TIMESTAMP,
      
      channels JSONB NOT NULL,
      actions JSONB,
      
      -- Indexes for common queries
      CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
      CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON ${tablePrefix}notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON ${tablePrefix}notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON ${tablePrefix}notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON ${tablePrefix}notifications(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON ${tablePrefix}notifications(expires_at) WHERE expires_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON ${tablePrefix}notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
  `,
    preferences: (tablePrefix) => `
    CREATE TABLE IF NOT EXISTS ${tablePrefix}preferences (
      user_id VARCHAR(255) PRIMARY KEY,
      channels JSONB NOT NULL DEFAULT '{}',
      global_mute BOOLEAN DEFAULT FALSE,
      data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_preferences_updated_at ON ${tablePrefix}preferences(updated_at DESC);
  `,
    receipts: (tablePrefix) => `
    CREATE TABLE IF NOT EXISTS ${tablePrefix}delivery_receipts (
      id SERIAL PRIMARY KEY,
      notification_id VARCHAR(255) NOT NULL,
      channel VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      last_attempt TIMESTAMP NOT NULL DEFAULT NOW(),
      next_retry TIMESTAMP,
      error TEXT,
      metadata JSONB,
      
      CONSTRAINT fk_notification FOREIGN KEY (notification_id) 
        REFERENCES ${tablePrefix}notifications(id) ON DELETE CASCADE,
      CONSTRAINT valid_receipt_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_receipts_notification_id ON ${tablePrefix}delivery_receipts(notification_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_status ON ${tablePrefix}delivery_receipts(status);
  `
};
