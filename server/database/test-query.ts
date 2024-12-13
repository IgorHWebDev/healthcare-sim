import pool from './index';

async function runTestQueries() {
    try {
        console.log('\n=== Running Test Queries ===\n');

        // Test 1: Count users
        const usersResult = await pool.query('SELECT COUNT(*) FROM bot_schema.bot_users');
        console.log('Total users:', usersResult.rows[0].count);

        // Test 2: Check practice sessions
        const sessionsResult = await pool.query(`
            SELECT status, COUNT(*) 
            FROM bot_schema.practice_sessions 
            GROUP BY status
        `);
        console.log('\nPractice sessions by status:');
        sessionsResult.rows.forEach(row => {
            console.log(`${row.status}: ${row.count}`);
        });

        // Test 3: Check user progress
        const progressResult = await pool.query(`
            SELECT up.completed_count, up.total_count
            FROM bot_schema.user_progress up
            LIMIT 5
        `);
        console.log('\nSample user progress (top 5):');
        progressResult.rows.forEach((row, index) => {
            console.log(`Progress ${index + 1}: ${row.completed_count}/${row.total_count}`);
        });

    } catch (error) {
        console.error('Error running test queries:', error);
    } finally {
        await pool.end();
    }
}

runTestQueries();
