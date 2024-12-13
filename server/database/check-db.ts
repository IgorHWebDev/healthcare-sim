import pool from './index';

async function checkDatabase() {
    const client = await pool.connect();
    try {
        console.log('\n=== Checking Database Structure ===\n');

        // Check current user and database
        const userResult = await client.query('SELECT current_user, current_database();');
        console.log('Current user:', userResult.rows[0].current_user);
        console.log('Current database:', userResult.rows[0].current_database);

        // List schemas
        console.log('\nAvailable schemas:');
        const schemas = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog');
        `);
        console.log(schemas.rows);

        // List tables
        console.log('\nAvailable tables:');
        const tables = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
        `);
        console.log(tables.rows);

        // Check table permissions
        console.log('\nTable permissions:');
        const permissions = await client.query(`
            SELECT table_schema, table_name, privilege_type
            FROM information_schema.table_privileges 
            WHERE grantee = current_user
            AND table_schema NOT IN ('information_schema', 'pg_catalog');
        `);
        console.log(permissions.rows);

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDatabase();
