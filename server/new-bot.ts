import { Telegraf, Markup, session } from 'telegraf';
import { Context } from 'telegraf';
import * as dotenv from 'dotenv';
import path from 'path';
import MIMICService from './services/mimic-service';
import { VertexAIService } from './services/vertex-ai';
import { MedicalCase } from './types';

// Load environment variables
dotenv.config();

// Validate BOT_TOKEN
if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN must be provided!');
}

// Initialize services
const mimicService = MIMICService.getInstance();
const vertexService = VertexAIService.getInstance();

interface SessionData {
    currentCase?: MedicalCase;
    totalCases: number;
    correctDiagnoses: number;
    selectedDifficulty?: 'basic' | 'intermediate' | 'advanced';
    awaitingDiagnosis: boolean;
}

interface BotContext extends Context {
    session: SessionData;
}

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN);

// Log bot creation
console.log('Bot instance created:', {
    timestamp: new Date().toISOString(),
    env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL
    }
});

// Add session middleware
bot.use(session());

// Set bot commands
bot.telegram.setMyCommands([
    { command: 'start', description: 'Begin your training journey' },
    { command: 'practice', description: 'Start a new ED case simulation' },
    { command: 'progress', description: 'View your performance statistics' },
    { command: 'help', description: 'Show instructions and tips' }
]);

// Initialize session data
function getInitialSessionData(): SessionData {
    return {
        totalCases: 0,
        correctDiagnoses: 0,
        awaitingDiagnosis: false
    };
}

async function formatCase(medCase: MedicalCase): Promise<string> {
    return `🏥 *Emergency Department Case*

*Patient Demographics:*
• Age: ${medCase.demographics.age}
• Gender: ${medCase.demographics.gender}

*Chief Complaint:*
${medCase.chiefComplaint}

*Vital Signs:*
• BP: ${medCase.vitals.bloodPressure}
• HR: ${medCase.vitals.heartRate}
• RR: ${medCase.vitals.respiratoryRate}
• Temp: ${medCase.vitals.temperature}°C
• SpO2: ${medCase.vitals.oxygenSaturation}%

*History of Present Illness:*
${medCase.history.presentIllness}

*Past Medical History:*
${medCase.history.pastMedical.join(', ')}

*Current Medications:*
${medCase.history.medications.join(', ')}

*Physical Examination:*
${medCase.physicalExam.join('\n')}

What is your diagnosis and management plan?`;
}

// Start command
bot.command('start', async (ctx) => {
    ctx.session = getInitialSessionData();

    const welcomeMessage = `Welcome to MedSim Mentor! 🏥

I'm your medical education assistant, powered by MIMIC-4 database and Vertex AI. Practice with real emergency medicine cases and receive detailed feedback on your clinical decision-making.

*Available Commands:*
/practice - Start a new case
/progress - View your statistics
/help - Show instructions

Ready to begin? Use /practice to start your first case!`;

    await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
            ['🏥 New Case', '📊 Statistics'],
            ['❓ Help']
        ]).resize()
    });
});

// Practice command
bot.command('practice', async (ctx) => {
    await ctx.reply('Select case difficulty:', 
        Markup.keyboard([
            ['😊 Basic', '🤔 Intermediate'],
            ['🧐 Advanced', '⬅️ Back']
        ]).resize()
    );
});

// Handle difficulty selection
bot.hears(['😊 Basic', '🤔 Intermediate', '🧐 Advanced'], async (ctx) => {
    const difficultyMap = {
        '😊 Basic': 'basic',
        '🤔 Intermediate': 'intermediate',
        '🧐 Advanced': 'advanced'
    } as const;
    
    const selectedDifficulty = difficultyMap[ctx.message.text as keyof typeof difficultyMap];
    
    try {
        // Get case from MIMIC database
        const medCase = await mimicService.getMIMICCase(selectedDifficulty);
        ctx.session.currentCase = medCase;
        ctx.session.selectedDifficulty = selectedDifficulty;
        ctx.session.awaitingDiagnosis = true;
        
        await ctx.reply(await formatCase(medCase), { 
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['🔍 Submit Diagnosis'],
                ['💡 Get Hint', '⬅️ Back']
            ]).resize()
        });
    } catch (error) {
        console.error('Error getting case:', error);
        await ctx.reply('Sorry, there was an error generating the case. Please try again.');
    }
});

// Progress command
bot.command('progress', async (ctx) => {
    const stats = `📊 *Your Performance Statistics*

Total Cases: ${ctx.session.totalCases}
Correct Diagnoses: ${ctx.session.correctDiagnoses}
Success Rate: ${ctx.session.totalCases > 0 ? 
        Math.round((ctx.session.correctDiagnoses / ctx.session.totalCases) * 100) : 0}%

Keep practicing to improve your skills!`;
    
    await ctx.reply(stats, { parse_mode: 'Markdown' });
});

// Help command
bot.command('help', async (ctx) => {
    const helpText = `*MedSim Mentor - Help Guide*
    
🏥 *Practice Cases:*
1. Use /practice to start a new case
2. Choose difficulty level
3. Review patient information
4. Submit your diagnosis
5. Get AI-powered feedback

*Difficulty Levels:*
😊 Basic: Clear presentations, common conditions
🤔 Intermediate: More complex cases
🧐 Advanced: Challenging cases, atypical presentations

*Tips:*
• Consider all vital signs and exam findings
• Review past medical history carefully
• Think about differential diagnoses
• Use the hint feature if needed`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Handle menu buttons
bot.hears('🏥 New Case', (ctx) => ctx.reply('/practice'));
bot.hears('📊 Statistics', (ctx) => ctx.reply('/progress'));
bot.hears('❓ Help', (ctx) => ctx.reply('/help'));

// Handle hint request
bot.hears('💡 Get Hint', async (ctx) => {
    if (!ctx.session.currentCase) {
        await ctx.reply('Please start a new case first using /practice');
        return;
    }

    try {
        const hints = await vertexService.getHints(ctx.session.currentCase);
        await ctx.reply(`💡 *Diagnostic Hints:*\n\n${hints.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error getting hints:', error);
        await ctx.reply('Sorry, I could not generate hints at this moment. Please try again.');
    }
});

// Handle back button
bot.hears('⬅️ Back', async (ctx) => {
    await ctx.reply('Main Menu:', Markup.keyboard([
        ['🏥 New Case', '📊 Statistics'],
        ['❓ Help']
    ]).resize());
});

// Handle diagnosis submission
bot.hears('🔍 Submit Diagnosis', async (ctx) => {
    if (!ctx.session.currentCase) {
        await ctx.reply('Please start a new case first using /practice');
        return;
    }

    await ctx.reply('Please enter your diagnosis and key management steps. Be specific and consider the following:\n\n' +
        '1. Primary diagnosis\n' +
        '2. Key differential diagnoses\n' +
        '3. Initial management steps\n' +
        '4. Any immediate interventions needed');
    
    ctx.session.awaitingDiagnosis = true;
});

// Handle text messages (for diagnosis responses)
bot.on('text', async (ctx) => {
    if (!ctx.session.currentCase || !ctx.session.awaitingDiagnosis || ctx.message.text.startsWith('/')) return;

    try {
        const feedback = await vertexService.analyzeCaseResponse(
            ctx.message.text,
            ctx.session.currentCase.expectedDiagnoses.primary,
            ctx.session.selectedDifficulty || 'basic'
        );

        if (feedback.isCorrect) {
            ctx.session.correctDiagnoses++;
        }

        ctx.session.totalCases++;
        
        const feedbackMessage = `${feedback.isCorrect ? '🎉 Correct!' : '❌ Not quite correct.'}\n\n` +
            `*Feedback:*\n${feedback.explanation}\n\n` +
            `*Expected Diagnosis:* ${ctx.session.currentCase.expectedDiagnoses.primary}\n\n` +
            `*Key Learning Points:*\n${feedback.learningPoints.join('\n')}\n\n` +
            'Would you like to try another case? Use /practice to continue.';

        await ctx.reply(feedbackMessage, { parse_mode: 'Markdown' });
        
        ctx.session.currentCase = undefined;
        ctx.session.awaitingDiagnosis = false;
    } catch (error) {
        console.error('Error analyzing response:', error);
        await ctx.reply('Sorry, there was an error analyzing your response. Please try again.');
    }
});

// Initialize bot with webhook in production
if (process.env.NODE_ENV === 'production') {
    const VERCEL_URL = process.env.VERCEL_URL || 'https://bot16122024-h6nw42h51-igors-projects-c46e9eb7.vercel.app';
    const webhookUrl = `https://${VERCEL_URL}/api/webhook`;
    
    // Log bot initialization
    console.log('Initializing bot in production mode:', {
        webhookUrl,
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            VERCEL_URL: process.env.VERCEL_URL
        }
    });

    // Generate a secret token for webhook
    const secretToken = Math.random().toString(36).substring(2, 15);
    console.log('Generated webhook secret token:', secretToken);

    // Set webhook with additional options
    bot.telegram.setWebhook(webhookUrl, {
        drop_pending_updates: true,
        allowed_updates: ['message', 'callback_query'],
        secret_token: secretToken
    })
    .then(() => {
        console.log('Webhook set successfully:', {
            url: webhookUrl,
            timestamp: new Date().toISOString(),
            secretToken
        });
    })
    .catch((err) => {
        console.error('Failed to set webhook:', {
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            webhookUrl,
            timestamp: new Date().toISOString()
        });
    });

    // Periodically check webhook status
    setInterval(() => {
        bot.telegram.getWebhookInfo()
            .then((info) => {
                console.log('Webhook status:', {
                    info,
                    timestamp: new Date().toISOString()
                });
            })
            .catch((err) => {
                console.error('Failed to get webhook info:', {
                    error: err instanceof Error ? err.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            });
    }, 60000); // Check every minute
}

// Error handling
bot.catch((err: any) => {
    console.error('Bot error:', err);
});

export default bot;
