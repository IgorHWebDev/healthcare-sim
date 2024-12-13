import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
});

// Test database connection and initialize schema
async function checkConnection() {
    let client;
    try {
        client = await pool.connect();
        console.log('Successfully connected to database');
        
        // Initialize schema and tables
        await client.query('BEGIN');
        
        // Create schema if it doesn't exist
        await client.query(`CREATE SCHEMA IF NOT EXISTS bot_schema`);
        
        // Create practice_sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_schema.practice_sessions (
                id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                practice_type VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                score INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);
        
        // Create user_progress table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_schema.user_progress (
                user_id BIGINT PRIMARY KEY,
                total_sessions INTEGER DEFAULT 0,
                average_score FLOAT DEFAULT 0,
                last_session_at TIMESTAMP
            )
        `);
        
        await client.query('COMMIT');
        console.log('Database schema initialized successfully');
        return true;
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Database initialization error:', error);
        // Don't fail the bot startup if database isn't available
        console.log('Continuing without database support...');
        return true;
    } finally {
        if (client) {
            client.release();
        }
    }
}

export { checkConnection };
export default pool;