import * as fs from 'fs';
import * as path from 'path';
import pool from './index';

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        console.log('Starting database initialization...');
        
        // Start transaction
        await client.query('BEGIN');
        
        // Create schema if not exists
        await client.query('CREATE SCHEMA IF NOT EXISTS bot_schema');
        console.log('Schema created or verified');
        
        // Set search path
        await client.query('SET search_path TO bot_schema');
        console.log('Search path set');

        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        console.log('Reading schema from:', schemaPath);
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        console.log('Schema file read successfully');

        // Split and execute schema statements
        const statements = schemaContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log('Executing:', statement.substring(0, 50) + '...');
            await client.query(statement);
        }

        // Commit transaction
        await client.query('COMMIT');
        console.log('Database tables created successfully');

        // Verify tables
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'bot_schema'
        `);
        console.log('Created tables:', tables.rows.map(row => row.table_name));

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the initialization
initializeDatabase()
    .then(() => {
        console.log('Database initialization completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });