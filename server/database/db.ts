import pool from './index';

export interface User {
    user_id: number;
    username?: string;
    first_name?: string;
}

export interface Progress {
    category: string;
    completed_count: number;
    total_count: number;
}

export interface EDCase {
    id: number;
    case_type: string;
    difficulty_level: number;
    triage_level: string;
    chief_complaint: string;
    vital_signs: any;
    lab_results: any;
    correct_diagnosis: string;
}

export const db = {
    // User operations
    async createUser(user: User): Promise<void> {
        const query = `
            INSERT INTO bot_schema.bot_users (user_id, username, first_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE
            SET username = $2, first_name = $3`;
        
        await pool.query(query, [user.user_id, user.username, user.first_name]);
    },

    async getUser(userId: number): Promise<User | null> {
        const result = await pool.query('SELECT * FROM bot_schema.bot_users WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    },

    // Progress operations
    async initializeProgress(userId: number): Promise<void> {
        const categories = [
            ['case_studies', 10],
            ['knowledge_quizzes', 5],
            ['patient_assessments', 8],
            ['emergency_scenarios', 3]
        ];

        for (const [category, total] of categories) {
            await pool.query(`
                INSERT INTO bot_schema.user_progress (user_id, category, total_count)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, category) DO NOTHING`,
                [userId, category, total]
            );
        }
    },

    async getUserProgress(userId: number): Promise<Progress[]> {
        const result = await pool.query(
            'SELECT category, completed_count, total_count FROM bot_schema.user_progress WHERE user_id = $1',
            [userId]
        );
        return result.rows;
    },

    async updateProgress(userId: number, category: string): Promise<void> {
        await pool.query(`
            UPDATE bot_schema.user_progress 
            SET completed_count = completed_count + 1,
                last_updated = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND category = $2 AND completed_count < total_count`,
            [userId, category]
        );
    },

    // Practice session operations
    async startPracticeSession(userId: number, practiceType: string): Promise<number> {
        const result = await pool.query(
            `INSERT INTO bot_schema.practice_sessions (user_id, practice_type)
             VALUES ($1, $2)
             RETURNING id`,
            [userId, practiceType]
        );
        return result.rows[0].id;
    },

    async completePracticeSession(sessionId: number, score: number): Promise<void> {
        await pool.query(
            `UPDATE bot_schema.practice_sessions
             SET completed_at = CURRENT_TIMESTAMP,
                 score = $2,
                 status = 'completed'
             WHERE id = $1`,
            [sessionId, score]
        );
    },

    // ED-specific operations
    async createEDCase(caseData: Partial<EDCase>): Promise<number> {
        const result = await pool.query(`
            INSERT INTO bot_schema.ed_cases 
            (case_type, difficulty_level, triage_level, chief_complaint, vital_signs, lab_results, correct_diagnosis)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                caseData.case_type,
                caseData.difficulty_level,
                caseData.triage_level,
                caseData.chief_complaint,
                JSON.stringify(caseData.vital_signs),
                JSON.stringify(caseData.lab_results),
                caseData.correct_diagnosis
            ]
        );
        return result.rows[0].id;
    },

    async getEDCase(caseId: number): Promise<EDCase | null> {
        const result = await pool.query(
            'SELECT * FROM bot_schema.ed_cases WHERE id = $1',
            [caseId]
        );
        return result.rows[0] || null;
    },

    async submitEDResponse(
        sessionId: number,
        caseId: number,
        userId: number,
        response: {
            diagnosis: string,
            triage: string,
            resources: any,
            accuracy: number,
            responseTime: number
        }
    ): Promise<void> {
        await pool.query(`
            INSERT INTO bot_schema.ed_responses
            (session_id, case_id, user_id, user_diagnosis, triage_decision, resource_allocation, accuracy_score, response_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                sessionId,
                caseId,
                userId,
                response.diagnosis,
                response.triage,
                JSON.stringify(response.resources),
                response.accuracy,
                response.responseTime
            ]
        );

        // Update metrics
        await pool.query(`
            INSERT INTO bot_schema.ed_metrics
            (user_id, metric_type, metric_value)
            VALUES 
            ($1, 'diagnosis_accuracy', $2),
            ($1, 'triage_accuracy', $3)`,
            [userId, response.accuracy, response.accuracy]
        );
    },

    async getEDMetrics(userId: number): Promise<any[]> {
        const result = await pool.query(`
            SELECT metric_type, AVG(metric_value) as average_value
            FROM bot_schema.ed_metrics
            WHERE user_id = $1
            GROUP BY metric_type`,
            [userId]
        );
        return result.rows;
    }
}; 