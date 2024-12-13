-- Set search path
SET search_path TO bot_schema;

-- Insert categories
INSERT INTO categories (name, description) VALUES
    ('Emergency Medicine', 'Emergency department cases and scenarios'),
    ('Critical Care', 'Critical care and intensive care cases'),
    ('Trauma', 'Trauma and acute injury cases')
ON CONFLICT (name) DO NOTHING;

-- Insert case types
INSERT INTO case_types (name, description) VALUES
    ('Cardiac', 'Cardiovascular emergencies'),
    ('Neurological', 'Neurological emergencies'),
    ('Respiratory', 'Respiratory emergencies'),
    ('Trauma', 'Trauma cases'),
    ('Medical', 'General medical emergencies')
ON CONFLICT (name) DO NOTHING;

-- Insert metric types
INSERT INTO metric_types (name, description) VALUES
    ('Diagnostic Accuracy', 'Accuracy of diagnosis compared to correct diagnosis'),
    ('Triage Accuracy', 'Accuracy of triage level assignment'),
    ('Response Time', 'Time taken to provide diagnosis and triage'),
    ('Resource Efficiency', 'Efficiency in resource allocation')
ON CONFLICT (name) DO NOTHING;

-- Insert ED cases
INSERT INTO ed_cases (
    case_type_id,
    difficulty_level,
    triage_level,
    chief_complaint,
    vital_signs,
    lab_results,
    correct_diagnosis
) VALUES
    (
        (SELECT id FROM case_types WHERE name = 'Cardiac'),
        3,
        'urgent',
        'Chest pain with shortness of breath',
        '{
            "bp": "160/95",
            "hr": "110",
            "rr": "24",
            "temp": "37.2",
            "spo2": "95"
        }',
        '{
            "cbc": {
                "wbc": "12.5",
                "hgb": "14.2",
                "plt": "250"
            },
            "chem": {
                "sodium": "138",
                "potassium": "4.2",
                "creatinine": "1.1"
            },
            "cardiac": {
                "troponin": "0.15",
                "ck_mb": "25"
            }
        }',
        'Acute Coronary Syndrome'
    ),
    (
        (SELECT id FROM case_types WHERE name = 'Neurological'),
        4,
        'emergent',
        'Sudden onset severe headache with neck stiffness',
        '{
            "bp": "170/100",
            "hr": "88",
            "rr": "18",
            "temp": "37.8",
            "spo2": "99"
        }',
        '{
            "cbc": {
                "wbc": "12.5",
                "hgb": "13.8",
                "plt": "200"
            }
        }',
        'Subarachnoid Hemorrhage'
    )
ON CONFLICT DO NOTHING;
