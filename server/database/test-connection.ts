import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    const pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        connectionTimeoutMillis: 5000
    });

    try {
        console.log('\n=== Database Connection Test ===');
        console.log('Connection settings:');
        console.log('Host:', process.env.DB_HOST);
        console.log('Port:', process.env.DB_PORT);
        console.log('Database:', process.env.DB_NAME);
        console.log('User:', process.env.DB_USER);

        console.log('\nTrying to connect...');
        const client = await pool.connect();
        console.log('✅ Successfully connected to the database!');
        
        // Test schema existence
        console.log('\nChecking bot_schema...');
        const schemaResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = 'bot_schema'
        `);
        
        if (schemaResult.rows.length > 0) {
            console.log('✅ bot_schema exists');
        } else {
            console.log('❌ bot_schema does not exist');
        }

        // Test tables
        console.log('\nChecking tables in bot_schema:');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'bot_schema'
            ORDER BY table_name
        `);
        
        if (tablesResult.rows.length > 0) {
            console.log('Found tables:');
            tablesResult.rows.forEach(row => {
                console.log(`- ${row.table_name}`);
            });
        } else {
            console.log('❌ No tables found in bot_schema');
        }

        // Test permissions
        console.log('\nChecking permissions:');
        const permissionsResult = await client.query(`
            SELECT grantee, privilege_type, table_name
            FROM information_schema.table_privileges 
            WHERE table_schema = 'bot_schema'
            AND grantee = current_user
        `);
        
        if (permissionsResult.rows.length > 0) {
            console.log('Current user permissions:');
            permissionsResult.rows.forEach(row => {
                console.log(`- ${row.privilege_type} on ${row.table_name}`);
            });
        } else {
            console.log('❌ No explicit permissions found for current user');
        }

        client.release();
        console.log('\n✅ Connection test completed successfully!');
    } catch (err) {
        console.error('\n❌ Connection test failed:');
        if (err instanceof Error) {
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
        } else {
            console.error('Unknown error:', err);
        }
    } finally {
        await pool.end();
    }
}

// Run the test
testConnection(); 