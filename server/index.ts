import { VercelRequest, VercelResponse } from '@vercel/node';
import bot from './new-bot';

// Configure error logging
const logError = (error: unknown, context: string) => {
    console.error(`Error in ${context}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        context,
        timestamp: new Date().toISOString()
    });
};

// For local development
if (process.env.NODE_ENV !== 'production') {
    console.log('Starting MedSim Mentor bot in development mode...');
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
}

// For Vercel serverless deployment
export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('Received request:', {
        method: req.method,
        path: req.url,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });

    try {
        if (req.method === 'POST' && req.url?.includes('/api/webhook')) {
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