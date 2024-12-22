export const sampleCases = [
    {
        difficulty: "basic",
        chief_complaint: "28-year-old male presents with sudden onset chest pain for 2 hours",
        vital_signs: {
            bp: "125/75",
            hr: "88",
            rr: "16",
            temp: "37.0",
            spo2: "98"
        },
        lab_results: {
            cbc: {
                wbc: "7.5",
                hgb: "14.2",
                plt: "250"
            },
            chem: {
                sodium: "140",
                potassium: "4.0",
                creatinine: "0.9"
            },
            cardiac: {
                troponin: "0.02",
                ck_mb: "2.1"
            }
        },
        correct_diagnosis: "Anxiety-induced chest pain",
        triage_level: "3"
    },
    {
        difficulty: "intermediate",
        chief_complaint: "45-year-old female with progressive shortness of breath over 3 days",
        vital_signs: {
            bp: "142/88",
            hr: "102",
            rr: "24",
            temp: "37.8",
            spo2: "92"
        },
        lab_results: {
            cbc: {
                wbc: "12.5",
                hgb: "13.8",
                plt: "180"
            },
            chem: {
                sodium: "138",
                potassium: "4.2",
                creatinine: "1.1"
            },
            cardiac: {
                troponin: "0.01",
                ck_mb: "1.8"
            }
        },
        correct_diagnosis: "COVID-19 Pneumonia",
        triage_level: "2"
    },
    {
        difficulty: "advanced",
        chief_complaint: "62-year-old male with severe abdominal pain and vomiting",
        vital_signs: {
            bp: "85/55",
            hr: "125",
            rr: "22",
            temp: "38.5",
            spo2: "95"
        },
        lab_results: {
            cbc: {
                wbc: "18.5",
                hgb: "10.2",
                plt: "145"
            },
            chem: {
                sodium: "135",
                potassium: "5.2",
                creatinine: "2.1"
            }
        },
        correct_diagnosis: "Mesenteric ischemia",
        triage_level: "1"
    }
];
