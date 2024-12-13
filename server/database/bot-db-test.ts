import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { db } from './db';
import pool from './index';

dotenv.config();

async function testBotDatabaseConnectivity() {
    console.log('\n=== Testing Bot Database Connectivity ===\n');
    
    // 1. Test bot token
    const bot = new Telegraf(process.env.BOT_TOKEN!);
    try {
        const botInfo = await bot.telegram.getMe();
        console.log('✅ Bot Connection Test:');
        console.log(`Bot Username: @${botInfo.username}`);
        console.log(`Bot ID: ${botInfo.id}`);
        console.log(`Bot Name: ${botInfo.first_name}`);
    } catch (error) {
        console.error('❌ Bot Connection Failed:', error);
        process.exit(1);
    }

    // 2. Test database operations
    try {
        // Test user creation
        const testUser = {
            user_id: 12345,
            username: 'test_user',
            first_name: 'Test'
        };
        
        console.log('\n📝 Testing User Operations...');
        await db.createUser(testUser);
        console.log('✅ User created successfully');

        const retrievedUser = await db.getUser(testUser.user_id);
        console.log('✅ User retrieved successfully:', retrievedUser);

        // Test progress operations
        console.log('\n📊 Testing Progress Operations...');
        await db.initializeProgress(testUser.user_id);
        console.log('✅ Progress initialized');

        const progress = await db.getUserProgress(testUser.user_id);
        console.log('✅ Progress retrieved:', progress);

        // Test practice session
        console.log('\n🎯 Testing Practice Session...');
        const sessionId = await db.startPracticeSession(testUser.user_id, 'test_practice');
        console.log('✅ Practice session created:', sessionId);

        await db.completePracticeSession(sessionId, 85);
        console.log('✅ Practice session completed');

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        // Delete in correct order to respect foreign key constraints
        await pool.query('DELETE FROM bot_schema.user_progress WHERE user_id = $1', [testUser.user_id]);
        await pool.query('DELETE FROM bot_schema.practice_sessions WHERE user_id = $1', [testUser.user_id]);
        await pool.query('DELETE FROM bot_schema.bot_users WHERE user_id = $1', [testUser.user_id]);
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Database Test Failed:', error);
    } finally {
        // Close database connection
        await pool.end();
        await bot.stop();
    }
}

testBotDatabaseConnectivity()
    .then(() => console.log('\n✅ All tests completed!'))
    .catch(error => console.error('\n❌ Test failed:', error));
