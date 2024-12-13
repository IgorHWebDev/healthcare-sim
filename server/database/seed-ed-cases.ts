import pool from './index';

const edCases = [
    {
        difficulty_level: 3,
        triage_level: 'urgent',
        chief_complaint: 'Chest pain radiating to left arm, onset 2 hours ago',
        vital_signs: {
            bp: '150/90',
            hr: 95,
            rr: 20,
            temp: 37.2,
            spo2: 97
        },
        lab_results: {
            troponin: 0.05,
            cbc: {
                wbc: 8.5,
                hgb: 14.2,
                plt: 250
            }
        },
        correct_diagnosis: 'Acute Coronary Syndrome'
    },
    {
        difficulty_level: 4,
        triage_level: 'emergent',
        chief_complaint: 'Sudden onset severe headache with neck stiffness',
        vital_signs: {
            bp: '170/100',
            hr: 88,
            rr: 18,
            temp: 37.8,
            spo2: 99
        },
        lab_results: {
            cbc: {
                wbc: 12.5,
                hgb: 13.8,
                plt: 200
            }
        },
        correct_diagnosis: 'Subarachnoid Hemorrhage'
    }
];

async function seedEDCases() {
    const client = await pool.connect();
    try {
        console.log('Starting to seed ED cases...');
        
        // Insert ED cases directly
        for (const edCase of edCases) {
            const result = await client.query(`
                INSERT INTO bot_schema.ed_cases 
                (difficulty_level, triage_level, chief_complaint, vital_signs, lab_results, correct_diagnosis)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
                RETURNING id;
            `, [
                edCase.difficulty_level,
                edCase.triage_level,
                edCase.chief_complaint,
                edCase.vital_signs,
                edCase.lab_results,
                edCase.correct_diagnosis
            ]);
            
            if (result.rows.length > 0) {
                console.log(`Created ED case with ID: ${result.rows[0].id}`);
            }
        }

        console.log('Successfully seeded ED cases');

    } catch (error) {
        console.error('Error seeding ED cases:', error);
        throw error;
    } finally {
        client.release();
    }
}

seedEDCases()
    .then(() => {
        console.log('Completed seeding ED cases');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to seed ED cases:', error);
        process.exit(1);
    });
