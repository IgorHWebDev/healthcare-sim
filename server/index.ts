import { Telegraf } from 'telegraf';
import { verifyAndInitDatabase } from './database/verify';
import * as dotenv from 'dotenv';
import bot from './telegram-bot';

dotenv.config();

async function main() {
    try {
        console.log('Starting MedSim Telegram Bot...');

        // Verify and initialize database
        console.log('Verifying database...');
        await verifyAndInitDatabase();
        console.log('Database verification complete');

        // Start the bot
        console.log('Starting bot...');
        await bot.launch();
        console.log('Bot started successfully');

        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}

main();