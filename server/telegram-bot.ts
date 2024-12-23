import { Telegraf, Context } from 'telegraf';
import { session } from 'telegraf';
import dotenv from 'dotenv';
import { MyContext, SessionData } from './types/index';
import { VertexAIService } from './services/vertex-ai';

dotenv.config();

// Initialize services
const vertexAI = new VertexAIService();

// Initialize bot with session support
const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN!);

// Configure session middleware
bot.use(session());

// Initialize session data
function getInitialSessionData(): SessionData {
    return {
        userLevel: 'student',
        casesCompleted: 0,
        performanceStats: {
            totalCases: 0,
            correctDiagnoses: 0,
            correctTriages: 0,
            averageScore: 0
        },
        currentCase: undefined,
        caseStartTime: undefined,
        difficulty: undefined
    };
}

// Command handler middleware
bot.use(async (ctx, next) => {
    if (!ctx.session) {
        ctx.session = getInitialSessionData();
    }
    await next();
});

// Add error handling middleware
bot.catch((err, ctx) => {
    console.error(`Error while handling update ${ctx.update.update_id}:`, err);
    ctx.reply('An error occurred. Please try again or contact support if the issue persists.');
});

// Start command
bot.command('start', async (ctx) => {
    const message = `👋 Welcome to MedSim - Emergency Medicine Training Bot!

This bot uses AI and MIMIC-IV clinical database patterns to create realistic emergency department scenarios for practice.

Available commands:
/practice - Start a new ED case
/stats - View your performance statistics
/level - Set your training level
/help - Show detailed instructions

Type /practice to begin your first case!`;

    await ctx.reply(message);
});

// Help command
bot.command('help', async (ctx) => {
    const helpMessage = `📚 MedSim Bot Guide

How to Use:
1. Start a case with /practice
2. Read the case details carefully
3. Provide your assessment including:
   • Primary diagnosis
   • Differential diagnoses (3+)
   • Initial management steps
   • Triage level (1-5)

Triage Levels:
1 - Immediate (e.g., cardiac arrest)
2 - Emergent (e.g., acute MI)
3 - Urgent (e.g., abdominal pain)
4 - Semi-urgent (e.g., mild symptoms)
5 - Non-urgent (e.g., minor issues)

Example Response:
"Primary: Acute Coronary Syndrome
Differentials:
- Pulmonary Embolism
- Aortic Dissection
- GERD
Management:
1. ECG
2. IV access
3. Aspirin 325mg
4. Cardiac enzymes
Triage: Level 2"

Commands:
/practice - New case
/level - Change difficulty
/stats - View progress
/help - Show this guide

Need help? Just type /help again!`;

    await ctx.reply(helpMessage);
});

// Level command
bot.command('level', async (ctx) => {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '👨‍⚕️ Student', callback_data: 'level_student' },
                { text: '👨‍⚕️ Resident', callback_data: 'level_resident' }
            ],
            [
                { text: '👨‍⚕️ Attending', callback_data: 'level_attending' }
            ]
        ]
    };

    await ctx.reply('Select your training level:', { reply_markup: keyboard });
});

// Handle level selection
bot.action(/level_(.+)/, async (ctx) => {
    const level = ctx.match[1];
    if (ctx.session) {
        ctx.session.userLevel = level as 'student' | 'resident' | 'attending';
        await ctx.answerCbQuery(`Level set to ${level}`);
        await ctx.reply(`Your training level has been set to: ${level}\nUse /practice to start a new case!`);
    }
});

// Practice command
bot.command('practice', async (ctx) => {
    // Check if there's already an active case
    if (ctx.session?.currentCase) {
        await ctx.reply('You already have an active case. Please finish it first or type /cancel to start a new one.');
        return;
    }

    try {
        const complexity = ctx.session?.userLevel === 'attending' ? 'advanced' :
                          ctx.session?.userLevel === 'resident' ? 'intermediate' : 'basic';
        
        // Send status message
        const statusMessage = await ctx.reply('Generating a new case for you...');
        
        console.log(`Generating ${complexity} case for user level: ${ctx.session?.userLevel}`);
        
        // Set a timeout for case generation
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Case generation timed out')), 30000);
        });

        try {
            const medicalCase = await Promise.race([
                vertexAI.generateMedicalCase(complexity),
                timeoutPromise
            ]) as any;

            if (ctx.session) {
                ctx.session.currentCase = medicalCase;
                ctx.session.caseStartTime = Date.now();
                ctx.session.difficulty = complexity;
            }

            // Delete the "generating" message
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);
            
            await sendCaseWithOptions(ctx, medicalCase);
        } catch (error) {
            console.error('Error generating case:', error);
            
            // Delete the "generating" message
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);
            
            if (error instanceof Error && error.message === 'Case generation timed out') {
                await ctx.reply('Sorry, case generation is taking longer than expected. Please try again in a few moments.');
            } else {
                await ctx.reply('Sorry, there was an error generating the case. Please try again.');
            }
        }
    } catch (error) {
        console.error('Error in practice command:', error);
        await ctx.reply('An error occurred. Please try again or contact support if the issue persists.');
    }
});

// Add cancel command
bot.command('cancel', async (ctx) => {
    if (ctx.session?.currentCase) {
        ctx.session.currentCase = undefined;
        ctx.session.caseStartTime = undefined;
        ctx.session.difficulty = undefined;
        await ctx.reply('Current case cancelled. Use /practice to start a new one.');
    } else {
        await ctx.reply('No active case to cancel. Use /practice to start a new one.');
    }
});

// Feedback command
bot.command('feedback', async (ctx) => {
    if (!ctx.session?.lastEvaluation) {
        await ctx.reply('No recent case to provide feedback for. Complete a case first!');
        return;
    }

    const feedback = ` Last Case Feedback:

${ctx.session.lastEvaluation}

Want to try another case? Use /practice!`;

    await ctx.reply(feedback);
});

// Handle text messages
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    try {
        const userId = ctx.from?.id.toString();
        if (!userId || !ctx.session?.currentCase) {
            await ctx.reply('No active case. Use /practice to start one.');
            return;
        }

        // Record response time
        const responseTime = Date.now() - ctx.session.caseStartTime;

        // Get AI evaluation
        const evaluation = await vertexAI.evaluateResponse(
            ctx.message.text,
            ctx.session.currentCase
        );

        // Send evaluation feedback
        await ctx.reply(evaluation);

        // Update user stats in database
        // await db.submitEDResponse(
        //     ctx.session.sessionId,
        //     ctx.session.currentCase.id,
        //     parseInt(userId),
        //     {
        //         diagnosis: ctx.message.text,
        //         triage: ctx.message.text.match(/triage.*?(\d+)/i)?.[1] || '',
        //         resources: {},
        //         accuracy: 0, // Will be calculated by AI evaluation
        //         responseTime
        //     }
        // );

        // Clear current case
        ctx.session.currentCase = undefined;
        ctx.session.caseStartTime = undefined;
        ctx.session.difficulty = undefined;

        // Prompt for next case
        await ctx.reply('Ready for another case? Use /practice to continue!');

    } catch (error) {
        console.error('Error handling response:', error);
        await ctx.reply('Sorry, there was an error evaluating your response. Please try again.');
    }
});

async function handleUserResponse(ctx: Context): Promise<void> {
    try {
        const userId = ctx.from?.id.toString();
        if (!userId) {
            await ctx.reply('Error: Could not identify user');
            return;
        }

        const currentCase = ctx.session?.currentCase;
        if (!currentCase) {
            await ctx.reply('No active case found. Use /practice to start a new case.');
            return;
        }

        const userResponse = ctx.message?.text;
        if (!userResponse) {
            await ctx.reply('Please provide your assessment and plan.');
            return;
        }

        const evaluation = await vertexAI.evaluateResponse(userResponse, currentCase);

        // Format the evaluation response
        const response = [
            ' Evaluation of Your Response:',
            '',
            ' Primary Diagnosis:',
            `${evaluation.primaryDiagnosis.name} (Confidence: ${(evaluation.primaryDiagnosis.confidence * 100).toFixed(1)}%)`,
            'Reasoning:',
            ...evaluation.primaryDiagnosis.reasoning.map(r => `• ${r}`),
            '',
            ' Differential Diagnoses:',
            ...evaluation.differentialDiagnoses.map(d => 
                `• ${d.name} (Likelihood: ${(d.likelihood * 100).toFixed(1)}%)\n  Key Findings: ${d.keyFindings.join(', ')}`
            ),
            '',
            ' Suggested Workup:',
            ...evaluation.suggestedWorkup.map(w => `• ${w}`),
            '',
            ' Triage Level:',
            `Level ${evaluation.triageLevel.level}: ${evaluation.triageLevel.reasoning}`,
            '',
            ' Management Steps:',
            ...evaluation.managementSteps.map(m => `• ${m}`),
            '',
            ' Ready for another case? Use /practice to continue!'
        ].join('\n');

        await ctx.reply(response, { parse_mode: 'HTML' });
        
        // Update user statistics
        await updateUserStats(userId, evaluation);
        
        // Clear current case
        ctx.session.currentCase = undefined;
    } catch (error) {
        console.error('Error in handleUserResponse:', error);
        await ctx.reply('I apologize, but I encountered an error evaluating your response. Please try again or start a new case with /practice');
    }
}

async function updateUserStats(userId: string, evaluation: any): Promise<void> {
    try {
        const stats = {
            timestamp: new Date(),
            primaryDiagnosis: evaluation.primaryDiagnosis.name,
            confidence: evaluation.primaryDiagnosis.confidence,
            triageLevel: evaluation.triageLevel.level,
            differentialCount: evaluation.differentialDiagnoses.length
        };
        
        // Update performance stats
        if (ctx.session) {
            ctx.session.performanceStats.totalCases++;
            if (evaluation.diagnosisCorrect) {
                ctx.session.performanceStats.correctDiagnoses++;
            }
            if (evaluation.triageCorrect) {
                ctx.session.performanceStats.correctTriages++;
            }
            
            // Calculate new average score
            const totalScore = (evaluation.diagnosisCorrect ? 1 : 0) + (evaluation.triageCorrect ? 1 : 0);
            const oldTotal = ctx.session.performanceStats.averageScore * (ctx.session.performanceStats.totalCases - 1);
            ctx.session.performanceStats.averageScore = (oldTotal + totalScore) / ctx.session.performanceStats.totalCases;

            // Increment cases completed
            ctx.session.casesCompleted++;
        }
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

// Stats command
bot.command('stats', async (ctx) => {
    try {
        if (!ctx.session) {
            ctx.session = getInitialSessionData();
        }

        const stats = ctx.session.performanceStats;
        const message = ` Your Performance Statistics

Total Cases: ${stats.totalCases}
Correct Diagnoses: ${stats.correctDiagnoses}
Correct Triages: ${stats.correctTriages}
Average Score: ${stats.averageScore.toFixed(1)}%

Current Level: ${ctx.session.userLevel}
Cases Completed: ${ctx.session.casesCompleted}`;

        await ctx.reply(message);
    } catch (error) {
        console.error('Error in stats command:', error);
        await ctx.reply('Error retrieving statistics. Please try again.');
    }
});

// Interactive command handlers
bot.command('hint', async (ctx) => {
    try {
        const userId = ctx.from?.id.toString();
        if (!userId || !ctx.session?.currentCase) {
            await ctx.reply('No active case. Use /practice to start one.');
            return;
        }

        const hints = await vertexAI.generateHints(ctx.session.currentCase);
        await ctx.reply(' Key Findings to Consider:\n\n' + hints.join('\n'));
    } catch (error) {
        await handleError(ctx, 'Error generating hints', error);
    }
});

bot.command('explain', async (ctx) => {
    try {
        const userId = ctx.from?.id.toString();
        if (!userId || !ctx.session?.currentCase) {
            await ctx.reply('No active case. Use /practice to start one.');
            return;
        }

        const explanation = await vertexAI.explainCase(ctx.session.currentCase);
        await ctx.reply(' Case Explanation:\n\n' + explanation);
    } catch (error) {
        await handleError(ctx, 'Error generating explanation', error);
    }
});

bot.command('clarify', async (ctx) => {
    try {
        const question = ctx.message.text.split('/clarify ')[1];
        if (!question || !ctx.session?.currentCase) {
            await ctx.reply('Please provide a specific question about the case after /clarify');
            return;
        }

        const clarification = await vertexAI.clarifyQuestion(ctx.session.currentCase, question);
        await ctx.reply(' Clarification:\n\n' + clarification);
    } catch (error) {
        await handleError(ctx, 'Error getting clarification', error);
    }
});

// Interactive inline keyboard for case navigation
async function sendCaseWithOptions(ctx: Context, medicalCase: any): Promise<void> {
    const caseMessage = formatCase(medicalCase);
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💡 Get Hint', callback_data: 'hint' },
                { text: '🔍 Key Findings', callback_data: 'findings' }
            ],
            [
                { text: '📚 Similar Cases', callback_data: 'similar' },
                { text: '❓ Ask Question', callback_data: 'question' }
            ],
            [
                { text: '📋 Example Response', callback_data: 'example' },
                { text: '🏥 Guidelines', callback_data: 'guidelines' }
            ]
        ]
    };

    await ctx.reply(caseMessage, { reply_markup: keyboard });
}

function formatCase(medCase: any): string {
    const vitals = medCase.vitals;
    const isVitalAbnormal = (vital: string, value: number): boolean => {
        const ranges = {
            hr: { min: 60, max: 100 },
            rr: { min: 12, max: 20 },
            sbp: { min: 90, max: 140 },
            o2: { min: 95, max: 100 }
        };
        return value < ranges[vital]?.min || value > ranges[vital]?.max;
    };

    const formatVital = (name: string, value: any, unit: string = ''): string => {
        const numValue = parseFloat(value);
        const isAbnormal = isVitalAbnormal(name.toLowerCase(), numValue);
        return `${isAbnormal ? '⚠️ ' : ''}${name}: ${value}${unit}`;
    };

    return `🏥 New Emergency Department Case

👤 Patient Profile:
• Age: ${medCase.demographics.age}y/o
• Gender: ${medCase.demographics.gender}
• Chief Complaint: ${medCase.chiefComplaint}

📊 Vital Signs:
• ${formatVital('BP', vitals.bloodPressure)}
• ${formatVital('HR', vitals.heartRate, ' bpm')}
• ${formatVital('RR', vitals.respiratoryRate, '/min')}
• ${formatVital('Temp', vitals.temperature, '°C')}
• ${formatVital('O2', vitals.oxygenSaturation, '%')}

📝 History of Present Illness:
${medCase.presentIllness}

📋 Past Medical History:
${medCase.pastHistory.length ? medCase.pastHistory.map(h => `• ${h}`).join('\n') : 'None reported'}

💊 Current Medications:
${medCase.medications.length ? medCase.medications.map(m => `• ${m}`).join('\n') : 'None reported'}

🔍 Physical Examination:
${medCase.physicalExam.map(finding => `• ${finding}`).join('\n')}

💭 Assessment Tasks:
1. Most likely diagnosis
2. Key differential diagnoses (list at least 3)
3. Initial management steps
4. Triage level (1-5)

Use the buttons below for help or type your complete assessment.`;
}

// Handle interactive buttons
bot.action('hint', async (ctx) => {
    if (!ctx.session?.currentCase) {
        await ctx.answerCbQuery('No active case. Start a new one with /practice');
        return;
    }

    const hints = [
        '• Consider the vital sign trends',
        '• Review risk factors from PMH',
        '• Think about age-specific conditions',
        '• Note any red flag symptoms',
        '• Consider medication effects'
    ];

    await ctx.answerCbQuery('Showing hints...');
    await ctx.reply('💡 Diagnostic Hints:\n\n' + hints.join('\n'));
});

bot.action('findings', async (ctx) => {
    if (!ctx.session?.currentCase) {
        await ctx.answerCbQuery('No active case. Start a new one with /practice');
        return;
    }

    const case_findings = await vertexAI.analyzeKeyFindings(ctx.session.currentCase);
    await ctx.answerCbQuery('Analyzing key findings...');
    await ctx.reply('🔍 Key Clinical Findings:\n\n' + case_findings);
});

bot.action('example', async (ctx) => {
    const examples = {
        'Chest Pain': `Example Response for Chest Pain:
Primary: Acute Coronary Syndrome
Differentials:
• Pulmonary Embolism (↑HR, SOB)
• Aortic Dissection (HTN, sudden onset)
• Pneumothorax (chest pain, SOB)
• GERD (burning pain, post-prandial)

Management:
1. ECG & continuous monitoring
2. Large-bore IV access
3. Aspirin 325mg
4. Labs: troponin, BMP, CBC
5. CXR

Triage: Level 2 (emergent)
Reasoning: Possible ACS needs immediate evaluation`,

        'Abdominal Pain': `Example Response for Abdominal Pain:
Primary: Acute Appendicitis
Differentials:
• Cholecystitis (RUQ pain, post-prandial)
• Diverticulitis (LLQ pain, fever)
• Gastroenteritis (diffuse pain, diarrhea)
• Ovarian Cyst (female, sudden onset)

Management:
1. IV access & fluids
2. Labs: CBC, CMP, lipase, UA
3. Imaging: CT abdomen/pelvis
4. Pain control
5. Surgical consult if needed

Triage: Level 3 (urgent)
Reasoning: Stable vitals but needs timely evaluation`
    };

    await ctx.answerCbQuery('Showing example response...');
    await ctx.reply('📋 Example Response Format:\n\n' + 
        examples[ctx.session?.currentCase?.chiefComplaint] || examples['Chest Pain']);
});

bot.action('guidelines', async (ctx) => {
    const guidelines = `🏥 Clinical Guidelines:

Response Structure:
1. Primary Diagnosis
   • Most likely condition
   • Key supporting evidence
   • Pre-test probability

2. Differential Diagnoses
   • List at least 3 alternatives
   • Include evidence for each
   • Consider risk factors

3. Management Plan
   • Immediate actions first
   • Diagnostic tests
   • Treatments
   • Consultations needed

4. Triage Rationale
   • Level 1: Immediate (0 min)
   • Level 2: Emergent (< 15 min)
   • Level 3: Urgent (< 30 min)
   • Level 4: Semi-urgent (< 60 min)
   • Level 5: Non-urgent (< 120 min)

Tips:
• Be specific with diagnoses
• Consider worst-case scenarios
• Document your reasoning
• Prioritize critical actions`;

    await ctx.answerCbQuery('Showing guidelines...');
    await ctx.reply(guidelines);
});

// Handle inline keyboard callbacks
bot.action('hint', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await handleCommand(ctx, 'hint');
});

bot.action('explain', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await handleCommand(ctx, 'explain');
});

bot.action('ask_question', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Please type your question starting with /clarify');
});

bot.action('progress', async (ctx) => {
    await ctx.answerCbQuery();
    await handleCommand(ctx, 'stats');
});

async function handleCommand(ctx: Context, command: string): Promise<void> {
    try {
        await bot.telegram.sendCopy(ctx.chat.id, ctx.message, {
            reply_markup: ctx.message.reply_markup
        });
        await ctx.deleteMessage();
        await bot.command(command)(ctx);
    } catch (error) {
        console.error('Error handling command:', error);
        await ctx.reply('An error occurred. Please try again or contact support if the issue persists.');
    }
}

async function handleError(ctx: Context, message: string, error: Error): Promise<void> {
    console.error(message, error);
    await ctx.reply('An error occurred. Please try again or contact support if the issue persists.');
}

export default bot;