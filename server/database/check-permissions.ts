import pool from './index';

async function checkPermissions() {
    const client = await pool.connect();
    try {
        console.log('Checking database permissions and structure...\n');

        // Check current user
        const userResult = await client.query('SELECT current_user, current_database();');
        console.log('Current user:', userResult.rows[0].current_user);
        console.log('Current database:', userResult.rows[0].current_database);

        // List all schemas
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog');
        `);
        console.log('\nAvailable schemas:', schemasResult.rows.map(row => row.schema_name));

        // List all tables in public schema
        const tablesResult = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
        `);
        console.log('\nAvailable tables:');
        tablesResult.rows.forEach(row => {
            console.log(`- ${row.table_schema}.${row.table_name}`);
        });

    } catch (error) {
        console.error('Error checking permissions:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkPermissions();
