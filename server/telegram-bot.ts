import { Telegraf, Context } from 'telegraf';
import { session } from 'telegraf';
import dotenv from 'dotenv';
import { MyContext, SessionData, MedicalCase, UserLevel, PerformanceStats } from './types';
import VertexAIService from './services/vertex-ai';

dotenv.config();

// Initialize services
const vertexAI = VertexAIService.getInstance();

// Initialize bot with session support
const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN!);

// Configure session middleware
bot.use(session({
    defaultSession: () => ({
        userLevel: 'student' as UserLevel,
        casesCompleted: 0,
        performanceStats: {
            totalCases: 0,
            correctDiagnoses: 0,
            correctTriages: 0,
            averageScore: 0
        }
    })
}));

// Add error handling middleware
bot.catch((err, ctx) => {
    console.error(`Error while handling update ${ctx.update.update_id}:`, err);
    ctx.reply('An error occurred. Please try again or contact support if the issue persists.');
});

// Start command
bot.command('start', async (ctx) => {
    try {
        const message = `👋 Welcome to MedSim - Emergency Medicine Training Bot!

This bot uses AI and MIMIC-IV clinical database patterns to create realistic emergency department scenarios for practice.

Available commands:
/practice - Start a new ED case
/stats - View your performance statistics
/level - Set your training level
/help - Show detailed instructions

Type /practice to begin your first case!`;
        
        await ctx.reply(message);
    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('Error starting the bot. Please try again.');
    }
});

// Practice command
bot.command('practice', async (ctx) => {
    try {
        await ctx.reply('Generating a new case... Please wait.');
        
        // Generate a new case with appropriate complexity
        const complexity = ctx.session?.userLevel === 'attending' ? 'advanced' :
                          ctx.session?.userLevel === 'resident' ? 'intermediate' : 'basic';
        
        console.log(`Generating ${complexity} case for user level: ${ctx.session?.userLevel}`);
        const medicalCase = await vertexAI.generateMedicalCase(complexity);
        
        if (ctx.session) {
            ctx.session.currentCase = medicalCase;
        }
        
        const caseMessage = `🏥 New Emergency Department Case

👤 Patient: ${medicalCase.demographics.age}y/o ${medicalCase.demographics.gender}
📋 Chief Complaint: ${medicalCase.chiefComplaint}

Vitals:
• BP: ${medicalCase.vitals.bloodPressure}
• HR: ${medicalCase.vitals.heartRate}
• RR: ${medicalCase.vitals.respiratoryRate}
• Temp: ${medicalCase.vitals.temperature}°C
• O2: ${medicalCase.vitals.oxygenSaturation}%
${medicalCase.vitals.gcs ? `• GCS: ${medicalCase.vitals.gcs}` : ''}

History of Present Illness:
${medicalCase.history.presentIllness}

${medicalCase.history.pastMedical?.length ? `Past Medical History:
${medicalCase.history.pastMedical.join('\n')}` : ''}

${medicalCase.history.medications?.length ? `Medications:
${medicalCase.history.medications.join('\n')}` : ''}

${medicalCase.physicalExam?.length ? `Physical Exam:
${medicalCase.physicalExam.join('\n')}` : ''}

Please provide:
1. Primary diagnosis
2. Key differential diagnoses
3. Triage level (1-5)
4. Initial management plan

Reply with your assessment...`;

        await ctx.reply(caseMessage);
    } catch (error) {
        console.error('Error in practice command:', error);
        await ctx.reply('Sorry, there was an error generating the case. Please try again in a few moments.');
        
        // Log detailed error for debugging
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    }
});

// Handle text messages (user responses)
bot.on('text', async (ctx) => {
    try {
        if (!ctx.session?.currentCase) {
            await ctx.reply('Please start a new case with /practice first.');
            return;
        }

        const analysis = await vertexAI.analyzeCaseResponse(
            ctx.session.currentCase,
            ctx.message?.text || '',
            ctx.session.userLevel
        );

        // Update performance stats
        if (ctx.session?.performanceStats) {
            ctx.session.performanceStats.totalCases++;
            // Other stats updates will be handled by the analysis
        }

        await ctx.reply(analysis);
    } catch (error) {
        console.error('Error analyzing response:', error);
        await ctx.reply('Sorry, there was an error analyzing your response. Please try again.');
        
        // Log detailed error for debugging
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    }
});

// Level command
bot.command('level', async (ctx) => {
    try {
        const message = `Select your training level:
    
1. Student 👨‍🎓
2. Resident 👨‍⚕️
3. Attending 👨‍🏫

Reply with the number (1-3) of your level.`;
        
        await ctx.reply(message);
    } catch (error) {
        console.error('Error in level command:', error);
        await ctx.reply('Error setting training level. Please try again.');
    }
});

// Handle level selection
bot.hears(['1', '2', '3'], async (ctx) => {
    try {
        const levelMap = {
            '1': 'student',
            '2': 'resident',
            '3': 'attending'
        } as const;
        
        if (ctx.session && ctx.message?.text) {
            const level = levelMap[ctx.message.text as keyof typeof levelMap] as UserLevel;
            ctx.session.userLevel = level;
            await ctx.reply(`Training level set to: ${level}`);
        }
    } catch (error) {
        console.error('Error handling level selection:', error);
        await ctx.reply('Error setting training level. Please try again.');
    }
});

// Stats command
bot.command('stats', async (ctx) => {
    try {
        const stats = ctx.session?.performanceStats;
        if (!stats) {
            await ctx.reply('No performance statistics available yet. Try practicing some cases!');
            return;
        }

        const message = `📊 Your Performance Statistics

Total Cases: ${stats.totalCases}
Correct Diagnoses: ${stats.correctDiagnoses}
Correct Triage: ${stats.correctTriages}
Average Score: ${stats.averageScore.toFixed(1)}%

Keep practicing to improve your skills!`;

        await ctx.reply(message);
    } catch (error) {
        console.error('Error in stats command:', error);
        await ctx.reply('Error displaying performance statistics. Please try again.');
    }
});

export default bot;