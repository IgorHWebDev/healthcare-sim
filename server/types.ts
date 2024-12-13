import { Context } from 'telegraf';

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
    [key: string]: any;
}

interface EDCase {
    id: number;
    chief_complaint: string;
    correct_diagnosis: string;
    triage_level: string;
    vital_signs: VitalSigns;
    lab_results: LabResults;
}

interface SessionData {
    currentCase?: {
        chief_complaint: string;
        vital_signs: {
            bp: string;
            hr: string;
            rr: string;
            temp: string;
            spo2: string;
        };
        lab_results: Record<string, any>;
        correct_diagnosis: string;
        triage_level: string;
    };
    sessionId?: number;
    aiAnalysis?: string;
}

interface MyContext extends Context {
    session?: SessionData;
}

export { MyContext, SessionData };
