import { Telegraf, Markup, session } from 'telegraf';
import { Context } from 'telegraf';
import { sampleCases } from './data/sample-cases';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const token = process.env.BOT_TOKEN;
if (!token) {
    throw new Error('BOT_TOKEN must be provided!');
}

console.log('Initializing bot with token:', token.slice(0, 5) + '...');

const bot = new Telegraf<BotContext>(token);

interface VitalSigns {
    bp: string;
    hr: string;
    rr: string;
    temp: string;
    spo2: string;
}

interface LabResults {
    cbc?: {
        wbc: string;
        hgb: string;
        plt: string;
    };
    chem?: {
        sodium: string;
        potassium: string;
        creatinine: string;
    };
    cardiac?: {
        troponin: string;
        ck_mb: string;
    };
    other?: {
        pregnancy_test?: string;
    };
}

interface EDCase {
    difficulty: string;
    chief_complaint: string;
    vital_signs: VitalSigns;
    lab_results: LabResults;
    correct_diagnosis: string;
    triage_level: string;
}

interface SessionData {
    currentCase?: EDCase;
    totalCases: number;
    correctDiagnoses: number;
    selectedDifficulty?: string;
}

interface BotContext extends Context {
    session: SessionData;
}

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
        correctDiagnoses: 0
    };
}

function formatCase(edCase: EDCase): string {
    return `🏥 *Emergency Department Case*

*Chief Complaint:*
${edCase.chief_complaint}

*Vital Signs:*
• BP: ${edCase.vital_signs.bp}
• HR: ${edCase.vital_signs.hr}
• RR: ${edCase.vital_signs.rr}
• Temp: ${edCase.vital_signs.temp}°C
• SpO2: ${edCase.vital_signs.spo2}%

*Laboratory Results:*
CBC:
• WBC: ${edCase.lab_results.cbc?.wbc || 'N/A'} K/µL
• Hgb: ${edCase.lab_results.cbc?.hgb || 'N/A'} g/dL
• Platelets: ${edCase.lab_results.cbc?.plt || 'N/A'} K/µL

Chemistry:
• Sodium: ${edCase.lab_results.chem?.sodium || 'N/A'} mEq/L
• Potassium: ${edCase.lab_results.chem?.potassium || 'N/A'} mEq/L
• Creatinine: ${edCase.lab_results.chem?.creatinine || 'N/A'} mg/dL

${edCase.lab_results.cardiac ? `Cardiac Markers:
• Troponin: ${edCase.lab_results.cardiac.troponin} ng/mL
• CK-MB: ${edCase.lab_results.cardiac.ck_mb} U/L` : ''}

*Triage Level:* ${edCase.triage_level}

What is your diagnosis and management plan?`;
}

// Start command
bot.command('start', async (ctx) => {
    ctx.session = getInitialSessionData();

    const welcomeMessage = `Welcome to MedSim Mentor! 🏥

I'm your medical education assistant, designed to help you practice emergency medicine cases and improve your clinical decision-making skills.

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
    };
    
    const selectedDifficulty = difficultyMap[ctx.message.text as keyof typeof difficultyMap];
    const availableCases = sampleCases.filter(c => c.difficulty === selectedDifficulty);
    
    if (availableCases.length === 0) {
        await ctx.reply('No cases available for this difficulty level. Please try another.');
        return;
    }

    const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
    ctx.session.currentCase = randomCase;
    
    await ctx.reply(formatCase(randomCase), { 
        parse_mode: 'Markdown',
        ...Markup.keyboard([
            ['🔍 Submit Diagnosis'],
            ['⬅️ Back']
        ]).resize()
    });
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
5. Get instant feedback

*Difficulty Levels:*
😊 Basic: Clear presentations, common conditions
🤔 Intermediate: More complex cases
🧐 Advanced: Challenging cases, atypical presentations

*Tips:*
• Consider all vital signs and lab results
• Think about differential diagnoses
• Include key management steps in your response`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Handle menu buttons
bot.hears('🏥 New Case', (ctx) => ctx.reply('/practice'));
bot.hears('📊 Statistics', (ctx) => ctx.reply('/progress'));
bot.hears('❓ Help', (ctx) => ctx.reply('/help'));

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

    await ctx.reply('Please enter your diagnosis. Be specific and include your key management steps.');
});

// Handle text messages (for diagnosis responses)
bot.on('text', async (ctx) => {
    if (!ctx.session.currentCase || ctx.message.text.startsWith('/')) return;

    const userResponse = ctx.message.text.toLowerCase();
    const correctDiagnosis = ctx.session.currentCase.correct_diagnosis.toLowerCase();

    if (userResponse.includes(correctDiagnosis)) {
        ctx.session.correctDiagnoses++;
        await ctx.reply('🎉 Correct diagnosis! Well done!\n\nWould you like to try another case? Use /practice to continue.');
    } else {
        await ctx.reply(`The correct diagnosis was: ${ctx.session.currentCase.correct_diagnosis}\n\nKeep practicing! Use /practice to try another case.`);
    }

    ctx.session.totalCases++;
    ctx.session.currentCase = undefined;
});

// Error handling
bot.catch((err: any, ctx: BotContext) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('An error occurred. Please try again or use /start to reset.');
});

// Add error logging for commands
bot.catch((err: any) => {
    console.error('Bot error:', err);
});

export default bot;
