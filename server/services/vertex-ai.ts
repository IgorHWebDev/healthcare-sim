import { VertexAI } from '@google-cloud/vertexai';
import { MedicalCase, UserLevel } from '../types/index';
import * as crypto from 'crypto';
import MIMICService from './mimic-service';
import { ErrorHandler, ErrorType } from './error-handler';

class VertexAIService {
    private static instance: VertexAIService;
    private vertex_ai: any;
    private mimicService: MIMICService;
    private cache: Map<string, { response: any, timestamp: number }> = new Map();
    private CACHE_TTL = 3600000; // 1 hour in milliseconds
    private requestQueue: Array<{ resolve: Function, reject: Function, prompt: string }> = [];
    private isProcessingQueue = false;
    private BATCH_SIZE = 50;
    private BATCH_WAIT_MS = 100;
    private errorHandler: ErrorHandler;

    // Fallback case templates
    private fallbackCases: { [key: string]: MedicalCase } = {
        basic: {
            id: 'fallback_basic',
            demographics: {
                age: 45,
                gender: 'male'
            },
            vitals: {
                bloodPressure: '120/80',
                heartRate: 80,
                respiratoryRate: 16,
                temperature: 37,
                oxygenSaturation: 98
            },
            chiefComplaint: 'Chest pain',
            presentingSymptoms: [
                'Central chest pain',
                'Mild shortness of breath',
                'Diaphoresis'
            ],
            history: {
                presentIllness: 'Patient presents with sudden onset chest pain that started 2 hours ago. Pain is described as pressure-like, located in the center of chest.',
                pastMedical: ['Hypertension', 'Type 2 Diabetes'],
                medications: ['Metformin', 'Lisinopril']
            },
            physicalExam: [
                'Alert and oriented x3',
                'Heart: Regular rate and rhythm, no murmurs',
                'Lungs: Clear to auscultation bilaterally',
                'No chest wall tenderness'
            ],
            expectedDiagnoses: {
                primary: 'Acute Coronary Syndrome',
                differential: [
                    'Anxiety',
                    'GERD',
                    'Costochondritis'
                ]
            },
            triageLevel: 2,
            educationalPoints: [
                'Always consider ACS in patients with chest pain',
                'Risk factors include hypertension and diabetes',
                'Initial workup should include ECG and cardiac enzymes'
            ],
            correctAnswer: 'Order immediate ECG, cardiac enzymes, establish IV access, give aspirin if no contraindications.',
            explanation: 'Given the presentation of central chest pain with risk factors (HTN, DM), ACS must be ruled out. The absence of chest wall tenderness and presence of diaphoresis increases concern for ACS.',
            difficulty: 'basic'
        },
        intermediate: {
            id: 'fallback_intermediate',
            demographics: {
                age: 68,
                gender: 'female'
            },
            vitals: {
                bloodPressure: '160/95',
                heartRate: 96,
                respiratoryRate: 22,
                temperature: 37.2,
                oxygenSaturation: 94
            },
            chiefComplaint: 'Shortness of breath',
            presentingSymptoms: [
                'Progressive dyspnea',
                'Orthopnea',
                'Leg swelling'
            ],
            history: {
                presentIllness: 'Progressive dyspnea over the past 3 days with worsening leg swelling. Patient reports orthopnea and PND.',
                pastMedical: ['Congestive Heart Failure', 'Atrial Fibrillation', 'CKD Stage 3'],
                medications: ['Furosemide', 'Metoprolol', 'Apixaban']
            },
            physicalExam: [
                'Mild respiratory distress',
                'JVD present',
                'Bilateral crackles in lung bases',
                'Bilateral 2+ pitting edema'
            ],
            expectedDiagnoses: {
                primary: 'Acute on Chronic Heart Failure',
                differential: [
                    'Pneumonia',
                    'Acute Kidney Injury',
                    'COPD Exacerbation'
                ]
            },
            triageLevel: 2,
            educationalPoints: [
                'Volume overload signs include JVD and peripheral edema',
                'Consider medication compliance',
                'Monitor renal function with diuresis'
            ],
            correctAnswer: 'Start IV diuresis, check BNP and renal function, obtain chest X-ray, consider BiPAP if work of breathing increases.',
            explanation: 'Patient presents with classic signs of heart failure exacerbation including orthopnea, PND, and volume overload. The presence of respiratory distress warrants close monitoring.',
            difficulty: 'intermediate'
        },
        advanced: {
            id: 'fallback_advanced',
            demographics: {
                age: 32,
                gender: 'female'
            },
            vitals: {
                bloodPressure: '85/50',
                heartRate: 135,
                respiratoryRate: 28,
                temperature: 39.8,
                oxygenSaturation: 92
            },
            chiefComplaint: 'Fever and severe abdominal pain',
            presentingSymptoms: [
                'Severe lower abdominal pain',
                'High fever',
                'Nausea and vomiting'
            ],
            history: {
                presentIllness: 'Sudden onset severe lower abdominal pain with fever and chills. Associated symptoms include nausea and vomiting. Last menstrual period 6 weeks ago.',
                pastMedical: ['None'],
                medications: ['None']
            },
            physicalExam: [
                'Appears ill and diaphoretic',
                'Abdomen: Diffuse tenderness, worse in RLQ with rebound',
                'Cervical motion tenderness on exam',
                'Positive psoas sign'
            ],
            expectedDiagnoses: {
                primary: 'Tubo-ovarian Abscess',
                differential: [
                    'Appendicitis',
                    'Ectopic Pregnancy',
                    'Pelvic Inflammatory Disease'
                ]
            },
            triageLevel: 1,
            educationalPoints: [
                'Consider pregnancy in all women of childbearing age',
                'Early broad-spectrum antibiotics are crucial',
                'Surgical consultation may be needed'
            ],
            correctAnswer: 'Stabilize with IV fluids, start broad-spectrum antibiotics, obtain pregnancy test, CBC, blood cultures, and urgent pelvic ultrasound. Consult OB/GYN.',
            explanation: 'Given the sepsis criteria (hypotension, tachycardia, fever) and exam findings suggestive of TOA, immediate resuscitation and antibiotics are needed. Pregnancy must be ruled out given LMP 6 weeks ago.',
            difficulty: 'advanced'
        }
    };

    private async retryWithExponentialBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        initialDelay: number = 1000
    ): Promise<T> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                console.error(`Attempt ${attempt + 1} failed:`, error);
                
                if (attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }

    private validateMedicalCase(medicalCase: any): MedicalCase {
        const requiredFields = [
            'id',
            'demographics',
            'vitals',
            'chiefComplaint',
            'presentingSymptoms',
            'history',
            'physicalExam',
            'expectedDiagnoses',
            'triageLevel',
            'educationalPoints',
            'correctAnswer',
            'explanation',
            'difficulty'
        ];

        // Check for missing fields
        for (const field of requiredFields) {
            if (!(field in medicalCase)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate demographics
        if (!medicalCase.demographics.age || !medicalCase.demographics.gender) {
            throw new Error('Invalid demographics');
        }

        // Validate vitals
        const vitals = medicalCase.vitals;
        if (!vitals.bloodPressure || !vitals.heartRate || !vitals.respiratoryRate ||
            !vitals.temperature || !vitals.oxygenSaturation) {
            throw new Error('Invalid vitals');
        }

        // Validate arrays
        if (!Array.isArray(medicalCase.presentingSymptoms) || medicalCase.presentingSymptoms.length === 0 ||
            !Array.isArray(medicalCase.physicalExam) || medicalCase.physicalExam.length === 0 ||
            !Array.isArray(medicalCase.history.pastMedical) ||
            !Array.isArray(medicalCase.history.medications) ||
            !Array.isArray(medicalCase.expectedDiagnoses.differential) || medicalCase.expectedDiagnoses.differential.length === 0 ||
            !Array.isArray(medicalCase.educationalPoints) || medicalCase.educationalPoints.length === 0) {
            throw new Error('Invalid array fields');
        }

        // Validate triage level
        if (typeof medicalCase.triageLevel !== 'number' || medicalCase.triageLevel < 1 || medicalCase.triageLevel > 5) {
            throw new Error('Invalid triage level');
        }

        // Validate strings
        if (typeof medicalCase.chiefComplaint !== 'string' || medicalCase.chiefComplaint.length === 0 ||
            typeof medicalCase.history.presentIllness !== 'string' || medicalCase.history.presentIllness.length === 0 ||
            typeof medicalCase.expectedDiagnoses.primary !== 'string' || medicalCase.expectedDiagnoses.primary.length === 0 ||
            typeof medicalCase.correctAnswer !== 'string' || medicalCase.correctAnswer.length === 0 ||
            typeof medicalCase.explanation !== 'string' || medicalCase.explanation.length === 0) {
            throw new Error('Invalid string fields');
        }

        // Validate difficulty
        if (!['basic', 'intermediate', 'advanced'].includes(medicalCase.difficulty)) {
            throw new Error('Invalid difficulty level');
        }

        return medicalCase as MedicalCase;
    }

    private constructor() {
        this.vertex_ai = new VertexAI({
            project: process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || '',
            location: process.env.VERTEX_LOCATION || process.env.REGION || 'us-central1'
        });
        this.mimicService = MIMICService.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        if (!this.vertex_ai.project) {
            throw new Error('Google Cloud project ID not set');
        }
        
        console.log(`Initialized Vertex AI with project: ${this.vertex_ai.project}, location: ${this.vertex_ai.location}`);
        
        // Start queue processor
        this.processQueue();
    }

    private async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        try {
            while (this.requestQueue.length > 0) {
                const batch = this.requestQueue.splice(0, this.BATCH_SIZE);
                console.log(`Processing batch of ${batch.length} requests`);

                try {
                    const responses = await Promise.allSettled(
                        batch.map(async req => {
                            try {
                                console.log('Generating content...');
                                const response = await this.generateSingleResponse(req.prompt);
                                console.log('Content generated successfully');
                                return response;
                            } catch (error) {
                                console.error('Error generating content:', error);
                                throw error;
                            }
                        })
                    );

                    responses.forEach((result, i) => {
                        if (result.status === 'fulfilled') {
                            batch[i].resolve(result.value);
                        } else {
                            console.error('Request failed:', result.reason);
                            batch[i].reject(result.reason);
                        }
                    });
                } catch (error) {
                    console.error('Batch processing error:', error);
                    batch.forEach(req => req.reject(error));
                }

                if (this.requestQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.BATCH_WAIT_MS));
                }
            }
        } catch (error) {
            console.error('Queue processing error:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private async generateSingleResponse(prompt: string): Promise<any> {
        try {
            console.log('Generating content with Vertex AI...');
            const model = this.vertex_ai.preview.getGenerativeModel({
                model: 'gemini-pro',
                generation_config: {
                    temperature: 0.3,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 1024,
                },
            });

            console.log('Sending prompt to model...');
            const request = {
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }],
                }],
            };

            const response = await model.generateContent(request);
            console.log('Got response from model');
            
            const result = await response.response;
            if (!result || !result.candidates || !result.candidates[0] || !result.candidates[0].content) {
                throw new Error('Invalid response structure from model');
            }

            const text = result.candidates[0].content.parts[0].text;
            if (!text) {
                throw new Error('No text in model response');
            }

            console.log('Response text:', text.substring(0, 100) + '...');
            return { text };
        } catch (error) {
            console.error('Error in generateSingleResponse:', error);
            throw error;
        }
    }

    async generateMedicalCase(complexity: 'basic' | 'intermediate' | 'advanced'): Promise<MedicalCase> {
        try {
            // First try to get a case from MIMIC-4
            try {
                console.log('Attempting to fetch case from MIMIC-4...');
                const mimicCase = await this.mimicService.getMIMICCase(complexity);
                console.log('Successfully retrieved case from MIMIC-4');
                return mimicCase;
            } catch (mimicError) {
                console.warn('Failed to get case from MIMIC-4, falling back to AI generation:', mimicError);
                
                const model = this.vertex_ai.preview.getGenerativeModel({
                    model: 'gemini-pro',
                    generation_config: {
                        temperature: 0.2,
                        topP: 0.7,
                        topK: 20,
                        maxOutputTokens: 1024,
                    },
                });

                const prompt = `You are an emergency medicine educator. Create a realistic emergency department case (${complexity} level).

The case should be structured as follows:

👤 Patient Demographics
- Age and gender
- Relevant social history (if applicable)

📋 Chief Complaint
- Primary reason for visit

Vitals:
- BP, HR, RR, Temp, O2 sat

History of Present Illness:
- Detailed description of the current problem
- Onset, duration, severity
- Associated symptoms

Past Medical History:
- Relevant medical conditions
- Current medications

Physical Exam:
- Pertinent positive and negative findings
- Organized by system

The case should be appropriate for ${complexity} level:
- Basic: Common conditions with typical presentations
- Intermediate: More complex presentations or comorbidities
- Advanced: Rare conditions or atypical presentations

Return the case in this EXACT format (valid JSON):
{
    "id": "unique_string",
    "demographics": {
        "age": number,
        "gender": "male" or "female"
    },
    "vitals": {
        "bloodPressure": "systolic/diastolic",
        "heartRate": number,
        "respiratoryRate": number,
        "temperature": number,
        "oxygenSaturation": number
    },
    "chiefComplaint": "string",
    "presentingSymptoms": ["array of symptoms"],
    "history": {
        "presentIllness": "string",
        "pastMedical": ["array of conditions"],
        "medications": ["array of medications"]
    },
    "physicalExam": ["array of findings"],
    "expectedDiagnoses": {
        "primary": "string",
        "differential": ["array of diagnoses"]
    },
    "triageLevel": number 1-5,
    "educationalPoints": ["array of learning points"],
    "correctAnswer": "string describing ideal management",
    "explanation": "string explaining reasoning",
    "difficulty": "${complexity}"
}`;

                const request = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }],
                    }],
                };

                const response = await model.generateContent(request);
                const result = await response.response;
                
                if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error('Invalid response structure from model');
                }

                const text = result.candidates[0].content.parts[0].text.trim();
                console.log('Parsing response:', text.substring(0, 100) + '...');
                
                try {
                    const medicalCase = JSON.parse(text) as MedicalCase;
                    const validatedCase = this.validateMedicalCase(medicalCase);
                    console.log('Successfully validated medical case');
                    return validatedCase;
                } catch (error) {
                    console.error('Failed to generate valid case, using fallback');
                    return this.fallbackCases[complexity];
                }
            }
        } catch (error) {
            console.error('All attempts failed, using fallback case');
            return this.fallbackCases[complexity];
        }
    }

    async evaluateResponse(userResponse: string, currentCase: any): Promise<string> {
        try {
            const prompt = `
You are an experienced emergency medicine physician evaluating a medical student's response to this case:

Case Details:
Chief Complaint: ${currentCase.chiefComplaint}
Vital Signs: ${JSON.stringify(currentCase.vitals)}
Lab Results: ${JSON.stringify(currentCase.labResults)}
Correct Diagnosis: ${currentCase.correctDiagnosis}
Triage Level: ${currentCase.triageLevel}

Student's Response:
${userResponse}

Evaluate the response and provide feedback in this format:
1. Diagnosis Assessment:
   - Is the diagnosis correct? (Yes/Partially/No)
   - Key findings supporting diagnosis
   - Missing important elements

2. Management Plan:
   - Appropriate immediate actions
   - Missing critical steps
   - Resource utilization assessment

3. Triage Assessment:
   - Is triage level appropriate? (Yes/No)
   - Reasoning for triage decision

4. Learning Points:
   - Key takeaways
   - Areas for improvement
   - Important clinical pearls

Keep feedback constructive and educational. Focus on patient safety and evidence-based practice.`;

            const result = await this.generateContent(prompt);
            return result;
        } catch (error) {
            console.error('Error in evaluateResponse:', error);
            return this.generateFallbackResponse(userResponse, currentCase);
        }
    }

    private generateFallbackResponse(userResponse: string, currentCase: any): string {
        const responseText = userResponse.toLowerCase();
        const diagnosisMatch = responseText.includes(currentCase.correctDiagnosis.toLowerCase());
        
        return `📋 Case Evaluation:

🔍 Diagnosis Assessment:
${diagnosisMatch ? '✅ Correct diagnosis identified' : '❌ Expected: ' + currentCase.correctDiagnosis}

⚡ Triage Level:
Expected: ${currentCase.triageLevel}

🏥 Key Points:
• Consider vital signs trends
• Review risk factors
• Think about immediate interventions

Keep practicing! Use evidence-based guidelines for management decisions.`;
    }

    interface CaseEvaluation {
        primaryDiagnosis: {
            name: string;
            confidence: number;
            reasoning: string[];
        };
        differentialDiagnoses: Array<{
            name: string;
            likelihood: number;
            keyFindings: string[];
        }>;
        suggestedWorkup: string[];
        triageLevel: {
            level: number;
            reasoning: string;
        };
        managementSteps: string[];
    }

    async analyzeCaseResponse(
        userResponse: string,
        correctAnswer: string,
        userLevel: UserLevel
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const prompt = `You are an emergency medicine educator evaluating a ${userLevel}'s response to this case:
${JSON.stringify(correctAnswer, null, 2)}

User's Response:
${userResponse}

Provide a CONCISE analysis in this format:

🎯 Diagnosis (1-2 lines):
- Primary: Was it correct?
- Differentials: Were they appropriate?

🔍 Clinical Assessment (2-3 bullet points):
- Key findings used/missed
- Vital signs interpretation
- Lab/imaging interpretation

📋 Management (2-3 bullet points):
- Triage level appropriate?
- Initial steps correct?
- Treatment plan feedback

📚 Learning Points (2-3 most important):
- Key takeaways
- Areas for improvement

Keep the total response under 500 words. Be direct and specific.`;

            this.requestQueue.push({
                resolve,
                reject,
                prompt
            });
            this.processQueue();
        });
    }

    async generateEducationalContent(
        topic: string,
        userLevel: UserLevel
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const prompt = `Generate educational medical content about ${topic} for a ${userLevel} level student...`;

            this.requestQueue.push({
                resolve,
                reject,
                prompt
            });
            this.processQueue();
        });
    }

    async generateHints(currentCase: MedicalCase): Promise<string[]> {
        console.log('Generating hints...');
        try {
            const prompt = `Given this medical case:
${JSON.stringify(currentCase, null, 2)}

Generate 3-5 key hints that would help guide the diagnosis without giving away the answer directly. 
Focus on important findings and relationships between symptoms.`;

            const hints = await this.generateContent(prompt);
            return JSON.parse(hints);
        } catch (error) {
            console.error('Error generating hints:', error);
            return [
                'Consider the relationship between vital signs and symptoms',
                'Look for patterns in the physical examination',
                'Think about risk factors in the patient\'s history'
            ];
        }
    }

    async explainCase(currentCase: MedicalCase): Promise<string> {
        try {
            const prompt = `
Analyze this medical case:
${JSON.stringify(currentCase, null, 2)}

Provide a clear, educational explanation of the key clinical features and their significance. 
Do not reveal the diagnosis, but explain the pathophysiological processes that might be occurring.`;

            return await this.generateContent(prompt);
        } catch (error) {
            throw new Error('Failed to explain case: ' + error.message);
        }
    }

    async clarifyQuestion(currentCase: MedicalCase, question: string): Promise<string> {
        try {
            const prompt = `
Regarding this medical case:
${JSON.stringify(currentCase, null, 2)}

Answer this specific question: "${question}"
Provide a clear, focused response without revealing the diagnosis.`;

            return await this.generateContent(prompt);
        } catch (error) {
            throw new Error('Failed to clarify question: ' + error.message);
        }
    }

    async analyzeKeyFindings(medicalCase: any): Promise<string> {
        try {
            const prompt = `
You are an experienced emergency medicine physician. Analyze this case and identify key clinical findings:

Case Details:
${JSON.stringify(medicalCase, null, 2)}

List the key clinical findings in these categories:
1. Critical Vital Signs
2. Important History Elements
3. Significant Exam Findings
4. Risk Factors
5. Red Flags

Format your response in a clear, bulleted list. Focus on findings that influence diagnosis and management.`;

            const result = await this.generateContent(prompt);
            return result;
        } catch (error) {
            console.error('Error analyzing findings:', error);
            return this.generateFallbackFindings(medicalCase);
        }
    }

    private generateFallbackFindings(medicalCase: any): string {
        const findings = [];
        
        // Check vitals
        const vitals = medicalCase.vitals;
        if (vitals) {
            if (parseInt(vitals.heartRate) > 100) findings.push('⚠️ Tachycardia');
            if (parseInt(vitals.respiratoryRate) > 20) findings.push('⚠️ Tachypnea');
            if (parseInt(vitals.oxygenSaturation) < 95) findings.push('⚠️ Hypoxia');
            
            const bp = vitals.bloodPressure.split('/');
            if (parseInt(bp[0]) > 140 || parseInt(bp[1]) > 90) findings.push('⚠️ Hypertension');
            if (parseInt(bp[0]) < 90) findings.push('⚠️ Hypotension');
        }

        // Check history
        if (medicalCase.pastHistory) {
            findings.push('\nSignificant History:');
            medicalCase.pastHistory.forEach(h => findings.push(`• ${h}`));
        }

        // Check physical exam
        if (medicalCase.physicalExam) {
            findings.push('\nKey Exam Findings:');
            medicalCase.physicalExam.forEach(f => findings.push(`• ${f}`));
        }

        return findings.join('\n');
    }

    private async generateContent(prompt: string): Promise<string> {
        try {
            // Your existing generateContent implementation
            return 'Generated content';
        } catch (error) {
            await this.errorHandler.handleError(
                null,
                error,
                ErrorType.AI_SERVICE
            );
            throw error;
        }
    }

    private calculateCost(usage: any): { cost: number, details: string } {
        const INPUT_COST_PER_1K = 0.00025;
        const OUTPUT_COST_PER_1K = 0.0005;
        
        const inputTokens = usage.promptTokens || 0;
        const outputTokens = usage.completionTokens || 0;
        
        const inputCost = (inputTokens / 1000) * INPUT_COST_PER_1K;
        const outputCost = (outputTokens / 1000) * OUTPUT_COST_PER_1K;
        const totalCost = inputCost + outputCost;
        
        return {
            cost: totalCost,
            details: `Tokens - Input: ${inputTokens}, Output: ${outputTokens}
Cost: $${totalCost.toFixed(4)} (Input: $${inputCost.toFixed(4)}, Output: $${outputCost.toFixed(4)})`
        };
    }

    public static getInstance(): VertexAIService {
        if (!VertexAIService.instance) {
            VertexAIService.instance = new VertexAIService();
        }
        return VertexAIService.instance;
    }
}

export default VertexAIService;
