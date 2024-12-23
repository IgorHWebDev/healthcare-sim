import { Context } from 'telegraf';

export type Difficulty = 'basic' | 'intermediate' | 'advanced';
export type UserLevel = 'student' | 'resident' | 'attending';

export interface Demographics {
    age: number;
    gender: string;
}

export interface Vitals {
    bloodPressure: string;
    heartRate: number;
    respiratoryRate: number;
    temperature: number;
    oxygenSaturation: number;
}

export interface History {
    presentIllness: string;
    pastMedical: string[];
    medications: string[];
}

export interface MedicalCase {
    demographics: Demographics;
    chiefComplaint: string;
    vitals: Vitals;
    history: History;
    physicalExam: string[];
}

export interface PerformanceStats {
    totalCases: number;
    correctDiagnoses: number;
    correctTriages: number;
    averageScore: number;
}

export interface SessionData {
    userLevel: UserLevel;
    casesCompleted: number;
    performanceStats: PerformanceStats;
    currentCase?: MedicalCase;
    caseStartTime?: number;
    difficulty?: Difficulty;
}

export interface MyContext extends Context {
    session: SessionData;
}

export interface CaseEvaluation {
    score: number;
    feedback: string;
    isCorrect: boolean;
}
