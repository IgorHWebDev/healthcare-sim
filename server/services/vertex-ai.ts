import { VertexAI } from '@google-cloud/vertexai';
import { MedicalCase, UserLevel } from '../types/index';

class VertexAIService {
    private static instance: VertexAIService;
    private vertex_ai: VertexAI;
    private project: string;
    private location: string;

    private constructor() {
        this.project = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || '';
        this.location = process.env.VERTEX_LOCATION || process.env.REGION || 'us-central1';
        
        if (!this.project) {
            throw new Error('Google Cloud project ID not set');
        }
        
        this.vertex_ai = new VertexAI({project: this.project, location: this.location});
        console.log(`Initialized Vertex AI with project: ${this.project}, location: ${this.location}`);
    }

    public static getInstance(): VertexAIService {
        if (!VertexAIService.instance) {
            VertexAIService.instance = new VertexAIService();
        }
        return VertexAIService.instance;
    }

    async generateMedicalCase(complexity: 'basic' | 'intermediate' | 'advanced'): Promise<MedicalCase> {
        const model = this.vertex_ai.preview.getGenerativeModel({
            model: 'gemini-pro',
            generationConfig: {
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024
            }
        });

        const prompt = `Generate a realistic emergency department case based on MIMIC-IV database patterns.
        Complexity level: ${complexity}

        Requirements:
        1. Use realistic vital signs and lab values based on MIMIC-IV patterns
        2. Create synthetic patient demographics
        3. Include common ED presentations and their variations
        4. Maintain medical accuracy while ensuring patient privacy
        5. Include appropriate diagnostic considerations and teaching points

        Return the case in this exact JSON format:
        {
            "id": "unique_case_id",
            "demographics": {
                "age": number,
                "gender": "male" or "female",
                "ethnicity": "optional string"
            },
            "vitals": {
                "bloodPressure": "systolic/diastolic",
                "heartRate": number,
                "respiratoryRate": number,
                "temperature": number,
                "oxygenSaturation": number,
                "gcs": optional number
            },
            "chiefComplaint": "string",
            "presentingSymptoms": ["symptom1", "symptom2", ...],
            "history": {
                "presentIllness": "string",
                "pastMedical": ["condition1", "condition2", ...],
                "medications": ["med1", "med2", ...],
                "allergies": ["allergy1", "allergy2", ...],
                "socialHistory": "string"
            },
            "physicalExam": ["finding1", "finding2", ...],
            "labResults": {
                "test_name": {
                    "value": number or string,
                    "unit": "string",
                    "reference": "optional reference range"
                }
            },
            "imaging": ["finding1", "finding2", ...],
            "expectedDiagnoses": {
                "primary": "string",
                "differential": ["diagnosis1", "diagnosis2", ...]
            },
            "triageLevel": number 1-5,
            "educationalPoints": ["point1", "point2", ...]
        }`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const textContent = response.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textContent) {
                throw new Error('No content generated');
            }

            const medicalCase: MedicalCase = JSON.parse(textContent);
            return this.validateMedicalCase(medicalCase);
        } catch (error) {
            console.error('Error generating medical case:', error);
            throw error;
        }
    }

    private validateMedicalCase(medicalCase: MedicalCase): MedicalCase {
        const requiredFields = [
            'id', 'demographics', 'vitals', 'chiefComplaint',
            'presentingSymptoms', 'history', 'expectedDiagnoses',
            'triageLevel', 'educationalPoints'
        ];

        for (const field of requiredFields) {
            if (!(field in medicalCase)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (medicalCase.triageLevel < 1 || medicalCase.triageLevel > 5) {
            throw new Error('Invalid triage level');
        }

        return medicalCase;
    }

    async analyzeCaseResponse(
        medicalCase: MedicalCase,
        userResponse: string,
        userLevel: UserLevel
    ): Promise<string> {
        const model = this.vertex_ai.preview.getGenerativeModel({
            model: 'gemini-pro',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        const prompt = `You are an experienced emergency medicine educator evaluating a ${userLevel}'s response to a medical case.

Case Details:
${JSON.stringify(medicalCase, null, 2)}

User's Response:
${userResponse}

Provide a detailed analysis including:
1. Diagnostic Accuracy
   - Correctness of primary diagnosis
   - Appropriateness of differential diagnoses
   - Recognition of key clinical features

2. Clinical Reasoning
   - Use of history and physical exam findings
   - Interpretation of vital signs
   - Integration of lab/imaging results

3. Management Plan
   - Appropriateness of triage level
   - Initial stabilization measures
   - Diagnostic workup plan
   - Treatment decisions

4. Educational Feedback
   - Key learning points
   - Areas for improvement
   - Relevant clinical guidelines
   - Important considerations

Format your response in a clear, educational manner appropriate for a ${userLevel} level learner.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to analyze response';
    }

    async generateEducationalContent(
        topic: string,
        userLevel: UserLevel
    ): Promise<string> {
        const model = this.vertex_ai.preview.getGenerativeModel({
            model: 'gemini-pro',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        const prompt = `Create educational content about "${topic}" for a ${userLevel} level learner.

Include:
1. Key Concepts
2. Pathophysiology
3. Clinical Presentation
4. Diagnostic Approach
5. Management Principles
6. Evidence-Based Guidelines
7. Clinical Pearls
8. Common Pitfalls
9. Recent Updates
10. Case-Based Examples

Base the content on current medical evidence and guidelines while maintaining appropriate depth for the learner's level.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate content';
    }
}

export default VertexAIService;
