"use strict";
// ============================================================================
// @notifyc/adapter-postgres
// PostgreSQL Storage Adapter for NotifyC
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStorageAdapter = void 0;
const pg_1 = require("pg");
const migrations_1 = require("./db/migrations");
// ============================================================================
// POSTGRES STORAGE ADAPTER
// ============================================================================
class PostgresStorageAdapter {
    constructor(config) {
        if (!config) {
            throw new Error('PostgresStorageAdapter requires configuration (pool, connectionString, or poolConfig). If you are using a framework like NestJS, ensure this class is provided correctly via a factory.');
        }
        if (config.pool) {
            this.pool = config.pool;
        }
        else if (config.connectionString) {
            this.pool = new pg_1.Pool({ connectionString: config.connectionString });
        }
        else if (config.poolConfig) {
            this.pool = new pg_1.Pool(config.poolConfig);
        }
        else {
            throw new Error('PostgresStorageAdapter requires pool, connectionString, or poolConfig');
        }
        this.schema = config.schema || 'public';
        this.tablePrefix = config.tablePrefix || 'notif_';
    }
    // ========== INITIALIZATION ==========
    async initialize() {
        const client = await this.pool.connect();
        try {
            await client.query(`SET search_path TO ${this.schema}`);
            await client.query(migrations_1.MIGRATIONS.notifications(this.tablePrefix));
            await client.query(migrations_1.MIGRATIONS.preferences(this.tablePrefix));
            await client.query(migrations_1.MIGRATIONS.receipts(this.tablePrefix));
        }
        finally {
            client.release();
        }
    }
    async close() {
        await this.pool.end();
    }
    // ========== CRUD OPERATIONS ==========
    async save(notification) {
        const query = `
      INSERT INTO ${this.tablePrefix}notifications (
        id, type, title, body, data,
        user_id, group_id,
        priority, category,
        status, read_at, created_at, scheduled_for, expires_at,
        channels, actions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        status = EXCLUDED.status,
        read_at = EXCLUDED.read_at,
        scheduled_for = EXCLUDED.scheduled_for,
        expires_at = EXCLUDED.expires_at,
        channels = EXCLUDED.channels,
        actions = EXCLUDED.actions
    `;
        await this.pool.query(query, [
            notification.id,
            notification.type,
            notification.title,
            notification.body,
            notification.data ? JSON.stringify(notification.data) : null,
            notification.userId,
            notification.groupId || null,
            notification.priority,
            notification.category || null,
            notification.status,
            notification.readAt || null,
            notification.createdAt,
            notification.scheduledFor || null,
            notification.expiresAt || null,
            JSON.stringify(notification.channels),
            notification.actions ? JSON.stringify(notification.actions) : null
        ]);
    }
    async saveBatch(notifications) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const notification of notifications) {
                await this.save(notification);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async findById(id) {
        const query = `
      SELECT * FROM ${this.tablePrefix}notifications
      WHERE id = $1
    `;
        const result = await this.pool.query(query, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        return this.rowToNotification(result.rows[0]);
    }
    async findByUser(userId, filters) {
        let query = `SELECT * FROM ${this.tablePrefix}notifications WHERE user_id = $1`;
        const params = [userId];
        let paramIndex = 2;
        // Apply filters
        if (filters) {
            if (filters.status) {
                const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
                query += ` AND status = ANY($${paramIndex})`;
                params.push(statuses);
                paramIndex++;
            }
            if (filters.type) {
                const types = Array.isArray(filters.type) ? filters.type : [filters.type];
                query += ` AND type = ANY($${paramIndex})`;
                params.push(types);
                paramIndex++;
            }
            if (filters.category) {
                const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
                query += ` AND category = ANY($${paramIndex})`;
                params.push(categories);
                paramIndex++;
            }
            if (filters.priority) {
                const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
                query += ` AND priority = ANY($${paramIndex})`;
                params.push(priorities);
                paramIndex++;
            }
            if (filters.startDate) {
                query += ` AND created_at >= $${paramIndex}`;
                params.push(filters.startDate);
                paramIndex++;
            }
            if (filters.endDate) {
                query += ` AND created_at <= $${paramIndex}`;
                params.push(filters.endDate);
                paramIndex++;
            }
            // Sorting
            const sortBy = filters.sortBy || 'created_at';
            const sortOrder = filters.sortOrder || 'desc';
            query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
            // Pagination
            if (filters.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(filters.limit);
                paramIndex++;
            }
            if (filters.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(filters.offset);
                paramIndex++;
            }
        }
        else {
            query += ` ORDER BY created_at DESC`;
        }
        const result = await this.pool.query(query, params);
        return result.rows.map((row) => this.rowToNotification(row));
    }
    async countUnread(userId) {
        const query = `
      SELECT COUNT(*) as count
      FROM ${this.tablePrefix}notifications
      WHERE user_id = $1 AND status != 'read'
    `;
        const result = await this.pool.query(query, [userId]);
        return parseInt(result.rows[0].count, 10);
    }
    // ========== STATE UPDATES ==========
    async markAsRead(id) {
        const query = `
      UPDATE ${this.tablePrefix}notifications
      SET status = 'read', read_at = NOW()
      WHERE id = $1
    `;
        await this.pool.query(query, [id]);
    }
    async markAllAsRead(userId) {
        const query = `
      UPDATE ${this.tablePrefix}notifications
      SET status = 'read', read_at = NOW()
      WHERE user_id = $1 AND status != 'read'
    `;
        await this.pool.query(query, [userId]);
    }
    async markAsUnread(id) {
        const query = `
      UPDATE ${this.tablePrefix}notifications
      SET status = 'pending', read_at = NULL
      WHERE id = $1
    `;
        await this.pool.query(query, [id]);
    }
    async markAllAsUnread(userId) {
        const query = `
      UPDATE ${this.tablePrefix}notifications
      SET status = 'pending', read_at = NULL
      WHERE user_id = $1 AND status = 'read'
    `;
        await this.pool.query(query, [userId]);
    }
    async delete(id) {
        const query = `
      DELETE FROM ${this.tablePrefix}notifications
      WHERE id = $1
    `;
        await this.pool.query(query, [id]);
    }
    // ========== PREFERENCES ==========
    async getPreferences(userId) {
        const query = `
      SELECT * FROM ${this.tablePrefix}preferences
      WHERE user_id = $1
    `;
        const result = await this.pool.query(query, [userId]);
        if (result.rows.length === 0) {
            return {
                userId,
                channels: {},
                globalMute: false
            };
        }
        const row = result.rows[0];
        return {
            userId: row.user_id,
            channels: row.channels,
            globalMute: row.global_mute,
            data: row.data,
            updatedAt: row.updated_at
        };
    }
    async savePreferences(userId, prefs) {
        const query = `
      INSERT INTO ${this.tablePrefix}preferences (
        user_id, channels, global_mute, data, updated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        channels = EXCLUDED.channels,
        global_mute = EXCLUDED.global_mute,
        data = EXCLUDED.data,
        updated_at = NOW()
    `;
        await this.pool.query(query, [
            userId,
            JSON.stringify(prefs.channels),
            prefs.globalMute || false,
            prefs.data ? JSON.stringify(prefs.data) : null
        ]);
    }
    // ========== CLEANUP ==========
    async deleteExpired() {
        const query = `
      DELETE FROM ${this.tablePrefix}notifications
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `;
        const result = await this.pool.query(query);
        return result.rowCount || 0;
    }
    // ========== DELIVERY RECEIPTS ==========
    async saveReceipt(receipt) {
        const query = `
      INSERT INTO ${this.tablePrefix}delivery_receipts (
        notification_id, channel, status, attempts,
        last_attempt, next_retry, error, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
        await this.pool.query(query, [
            receipt.notificationId,
            receipt.channel,
            receipt.status,
            receipt.attempts,
            receipt.lastAttempt,
            receipt.nextRetry || null,
            receipt.error || null,
            receipt.metadata ? JSON.stringify(receipt.metadata) : null
        ]);
    }
    async getReceipts(notificationId) {
        const query = `
      SELECT * FROM ${this.tablePrefix}delivery_receipts
      WHERE notification_id = $1
      ORDER BY last_attempt DESC
    `;
        const result = await this.pool.query(query, [notificationId]);
        return result.rows.map((row) => ({
            notificationId: row.notification_id,
            channel: row.channel,
            status: row.status,
            attempts: row.attempts,
            lastAttempt: row.last_attempt,
            nextRetry: row.next_retry,
            error: row.error,
            metadata: row.metadata
        }));
    }
    // ========== HELPER METHODS ==========
    rowToNotification(row) {
        return {
            id: row.id,
            type: row.type,
            title: row.title,
            body: row.body,
            data: row.data,
            userId: row.user_id,
            groupId: row.group_id,
            priority: row.priority,
            category: row.category,
            status: row.status,
            readAt: row.read_at,
            createdAt: row.created_at,
            scheduledFor: row.scheduled_for,
            expiresAt: row.expires_at,
            channels: row.channels,
            actions: row.actions
        };
    }
    // ========== ADVANCED QUERIES ==========
    async getNotificationsByGroup(groupId) {
        const query = `
      SELECT * FROM ${this.tablePrefix}notifications
      WHERE group_id = $1
      ORDER BY created_at DESC
    `;
        const result = await this.pool.query(query, [groupId]);
        return result.rows.map((row) => this.rowToNotification(row));
    }
    async getScheduledNotifications(before) {
        const query = `
      SELECT * FROM ${this.tablePrefix}notifications
      WHERE scheduled_for IS NOT NULL
        AND scheduled_for <= $1
        AND status = 'pending'
      ORDER BY scheduled_for ASC
    `;
        const result = await this.pool.query(query, [before || new Date()]);
        return result.rows.map((row) => this.rowToNotification(row));
    }
    async getStatsByUser(userId) {
        const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status != 'read') as unread,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'read') as read
      FROM ${this.tablePrefix}notifications
      WHERE user_id = $1
    `;
        const result = await this.pool.query(query, [userId]);
        return result.rows[0];
    }
}
exports.PostgresStorageAdapter = PostgresStorageAdapter;
// ============================================================================
// PACKAGE.JSON
// ============================================================================
/*
{
  "name": "@notifyc/adapter-postgres",
  "version": "1.0.0",
  "description": "PostgreSQL storage adapter for NotifyC",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "peerDependencies": {
    "@notifyc/core": "^1.0.0"
  },
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "typescript": "^5.0.0"
  }
}
*/
// ============================================================================
// USAGE EXAMPLE
// ============================================================================
/*
import { NotificationCenter } from '@notifyc/core';
import { PostgresStorageAdapter } from '@notifyc/adapter-postgres';

const storage = new PostgresStorageAdapter({
  connectionString: process.env.DATABASE_URL,
  schema: 'public',
  tablePrefix: 'notif_'
});

// Initialize tables
await storage.initialize();

const center = new NotificationCenter({
  storage,
  transports: [...]
});

await center.start();
*/ 
