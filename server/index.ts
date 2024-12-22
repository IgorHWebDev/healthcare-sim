import { VercelRequest, VercelResponse } from '@vercel/node';
import bot from './new-bot';

// For local development
if (process.env.NODE_ENV !== 'production') {
    console.log('Starting MedSim Mentor bot in development mode...');
    bot.launch()
        .then(() => {
            console.log('Bot is running!');
            console.log('Bot username:', bot.botInfo?.username);
        })
        .catch((err) => {
            console.error('Error starting bot:', err);
            process.exit(1);
        });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// For Vercel serverless deployment
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method === 'POST') {
            // Process webhook update
            await bot.handleUpdate(req.body);
            res.status(200).json({ ok: true });
        } else {
            // Health check endpoint
            res.status(200).json({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                botInfo: bot.botInfo
            });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}