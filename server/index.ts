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

// Verify Telegram webhook request
const verifyTelegramWebhook = (request: VercelRequest): boolean => {
    if (!request.headers['x-telegram-bot-api-secret-token']) {
        return false;
    }
    
    // In a real implementation, you would verify the secret token
    // For now, we'll just check if the request is coming from Telegram's IP range
    const telegramIPs = ['149.154.160.0/20', '91.108.4.0/22'];
    const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    
    console.log('Verifying webhook request:', {
        clientIP,
        headers: request.headers,
        timestamp: new Date().toISOString()
    });
    
    return true; // For now, accept all requests while debugging
};

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
        console.log('Environment validated:', {
            ...env,
            POSTGRES_PASSWORD: '***'
        });

        if (req.method === 'POST' && req.url?.includes('/api/webhook')) {
            // Verify webhook request
            if (!verifyTelegramWebhook(req)) {
                console.error('Invalid webhook request:', {
                    headers: req.headers,
                    timestamp: new Date().toISOString()
                });
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }

            console.log('Processing webhook update:', {
                body: req.body,
                timestamp: new Date().toISOString()
            });

            // Process webhook update
            await bot.handleUpdate(req.body);
            res.status(200).json({ ok: true });
        } else {
            // Health check endpoint
            const healthStatus = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                vercelEnv: process.env.VERCEL_ENV,
                vercelUrl: process.env.VERCEL_URL,
                botInfo: bot.botInfo,
                nodeVersion: process.version,
                memoryUsage: process.memoryUsage()
            };

            console.log('Health check response:', healthStatus);
            res.status(200).json(healthStatus);
        }
    } catch (error) {
        logError(error, 'handler');
        res.status(500).json({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}