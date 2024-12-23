import { VercelRequest, VercelResponse } from '@vercel/node';
import { config } from 'dotenv';
import bot from './new-bot';

// Load environment variables
config();

// Validate environment variables
const validateEnv = () => {
    const required = [
        'BOT_TOKEN',
        'GOOGLE_CLOUD_PROJECT',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_DB',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
        BOT_TOKEN: process.env.BOT_TOKEN!,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT!,
        POSTGRES_HOST: process.env.POSTGRES_HOST!,
        POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT!, 10),
        POSTGRES_DB: process.env.POSTGRES_DB!,
        POSTGRES_USER: process.env.POSTGRES_USER!,
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD!
    };
};

// Configure error logging
const logError = (error: unknown, context: string) => {
    console.error(`Error in ${context}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        context,
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            VERCEL_URL: process.env.VERCEL_URL
        }
    });
};

// For local development
if (process.env.NODE_ENV !== 'production') {
    console.log('Starting MedSim Mentor bot in development mode...');
    try {
        const env = validateEnv();
        console.log('Environment validated:', {
            ...env,
            POSTGRES_PASSWORD: '***'
        });
        
        bot.launch()
            .then(() => {
                console.log('Bot is running!');
                console.log('Bot username:', bot.botInfo?.username);
            })
            .catch((err) => {
                logError(err, 'bot.launch()');
                process.exit(1);
            });

        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
        logError(error, 'development initialization');
        process.exit(1);
    }
}

// For Vercel serverless deployment
export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('Received request:', {
        method: req.method,
        path: req.url,
        headers: req.headers,
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            VERCEL_URL: process.env.VERCEL_URL
        }
    });

    try {
        // Validate environment variables first
        const env = validateEnv();
        console.log('Environment validated');

        if (req.method === 'POST' && req.url?.includes('/api/webhook')) {
            // Process the update
            await bot.handleUpdate(req.body);
            res.status(200).json({ ok: true });
            return;
        }

        res.status(200).json({ ok: true, message: 'MedSim Mentor Bot is running' });
    } catch (error) {
        logError(error, 'webhook handler');
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
}