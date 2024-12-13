import pool from './index';
import * as fs from 'fs';
import * as path from 'path';

async function verifyAndInitDatabase() {
    const client = await pool.connect();
    try {
        console.log('Verifying database connection and schema...');

        // Read and execute schema.sql
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, 'schema.sql'),
            'utf8'
        );
        await client.query(schemaSQL);
        console.log('Schema verified/created successfully');

        // Check if we need to initialize data
        const result = await client.query(`
            SELECT COUNT(*) as count 
            FROM bot_schema.categories;
        `);

        if (result.rows[0].count === 0) {
            console.log('Initializing database with sample data...');
            const initSQL = fs.readFileSync(
                path.join(__dirname, 'init.sql'),
                'utf8'
            );
            await client.query(initSQL);
            console.log('Database initialized successfully');
        } else {
            console.log('Database already contains data, skipping initialization');
        }

        // Verify tables
        const tables = ['categories', 'case_types', 'metric_types', 'bot_users', 
                       'user_progress', 'practice_sessions', 'ed_cases', 
                       'ed_responses', 'ed_metrics'];
        
        for (const table of tables) {
            const tableResult = await client.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.tables 
                    WHERE table_schema = 'bot_schema' 
                    AND table_name = $1
                );
            `, [table]);
            
            if (!tableResult.rows[0].exists) {
                throw new Error(`Table ${table} does not exist`);
            }
        }
        console.log('All required tables exist');

        // Verify indexes
        const indexes = [
            'idx_user_progress_user_id',
            'idx_practice_sessions_user_id',
            'idx_ed_responses_user_id',
            'idx_ed_metrics_user_id',
            'idx_ed_cases_vital_signs',
            'idx_ed_cases_lab_results'
        ];

        for (const index of indexes) {
            const indexResult = await client.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_indexes 
                    WHERE schemaname = 'bot_schema' 
                    AND indexname = $1
                );
            `, [index]);
            
            if (!indexResult.rows[0].exists) {
                throw new Error(`Index ${index} does not exist`);
            }
        }
        console.log('All required indexes exist');

        return true;
    } catch (error) {
        console.error('Database verification failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

export { verifyAndInitDatabase };
