import VertexAIService from '../server/services/vertex-ai';

async function testMedicalAI() {
    console.log('Starting Medical AI tests...');
    const vertexAI = new VertexAIService();
    
    // Test case
    const testCase = {
        chief_complaint: "45-year-old male with sudden onset chest pain and shortness of breath",
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
        console.log('\n1. Testing medical case analysis...');
        const analysis = await vertexAI.analyzeMedicalCase(testCase);
        console.log('Analysis result:', analysis);

        console.log('\n2. Testing response evaluation...');
        const studentResponse = `
            Based on the presenting symptoms and lab values, this patient likely has Acute Coronary Syndrome.
            Key findings include:
            - Elevated troponin (0.15)
            - Chest pain with associated shortness of breath
            - Tachycardia (HR 110)
            - Hypertension (160/95)
            
            I would classify this as an emergent case requiring immediate ECG and cardiology consultation.
            Initial management should include aspirin, nitrates if BP remains elevated, and consideration
            of anticoagulation pending further workup.
        `;
        const evaluation = await vertexAI.evaluateResponse(
            testCase,
            studentResponse,
            "Acute Coronary Syndrome"
        );
        console.log('Evaluation result:', evaluation);

        console.log('\n3. Testing educational content generation...');
        const content = await vertexAI.generateEducationalContent(
            "Acute Coronary Syndrome",
            4 // Advanced level
        );
        console.log('Educational content:', content);

        console.log('\n4. Testing case variation generation...');
        const variations = await vertexAI.generateCaseVariations(testCase);
        console.log('Case variations:', variations);

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

testMedicalAI();
