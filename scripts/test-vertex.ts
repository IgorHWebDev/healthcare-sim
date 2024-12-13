import VertexAIService from '../server/services/vertex-ai';
import dotenv from 'dotenv';

dotenv.config();

async function testVertexAI() {
    const vertexAI = new VertexAIService();

    // Test case
    const testCase = {
        chief_complaint: "Chest pain with shortness of breath",
        vital_signs: {
            bp: "160/95",
            hr: "110",
            rr: "24",
            temp: "37.2",
            spo2: "95"
        },
        lab_results: {
            cbc: {
                wbc: "12.5",
                hgb: "14.2",
                plt: "250"
            },
            chem: {
                sodium: "138",
                potassium: "4.2",
                creatinine: "1.1"
            },
            cardiac: {
                troponin: "0.15",
                ck_mb: "25"
            }
        }
    };

    try {
        console.log('Testing medical case analysis...');
        const analysis = await vertexAI.analyzeMedicalCase(testCase);
        console.log('AI Analysis:', analysis);

        console.log('\nTesting response evaluation...');
        const evaluation = await vertexAI.evaluateResponse(
            testCase,
            "Based on the elevated troponin and chest pain, this appears to be Acute Coronary Syndrome. Given the vital signs, I would triage this as urgent.",
            "Acute Coronary Syndrome"
        );
        console.log('AI Evaluation:', evaluation);

        console.log('\nTesting educational content generation...');
        const content = await vertexAI.generateEducationalContent(
            "Acute Coronary Syndrome",
            3
        );
        console.log('Educational Content:', content);

        console.log('\nTesting case variation generation...');
        const variations = await vertexAI.generateCaseVariations(testCase);
        console.log('Case Variations:', variations);

    } catch (error) {
        console.error('Error testing Vertex AI:', error);
    }
}

testVertexAI();
