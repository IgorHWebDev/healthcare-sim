import { Context } from 'telegraf';

export type UserLevel = 'student' | 'resident' | 'attending';

export interface Demographics {
    age: number;
    gender: 'male' | 'female';
    ethnicity?: string;
}

export interface Vitals {
    bloodPressure: string;
    heartRate: number;
    respiratoryRate: number;
    temperature: number;
    oxygenSaturation: number;
    gcs?: number;
}

export interface History {
    presentIllness: string;
    pastMedical?: string[];
    medications?: string[];
    allergies?: string[];
    socialHistory?: string;
}

export interface LabResult {
    value: number | string;
    unit: string;
    reference?: string;
}

export interface Diagnoses {
    primary: string;
    differential: string[];
}

export interface MedicalCase {
    id: string;
    demographics: Demographics;
    vitals: Vitals;
    chiefComplaint: string;
    presentingSymptoms: string[];
    history: History;
    physicalExam?: string[];
    labResults?: Record<string, LabResult>;
    imaging?: string[];
    expectedDiagnoses: Diagnoses;
    triageLevel: number;
    educationalPoints: string[];
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
    currentCase?: MedicalCase;
    performanceStats: PerformanceStats;
}

export interface MyContext extends Context {
    session: SessionData;
}
