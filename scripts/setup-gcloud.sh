#!/bin/bash

# Set project ID
PROJECT_ID="promptedvisionsai"
REGION="us-central1"

# Configure gcloud
echo "Configuring gcloud..."
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    iam.googleapis.com

# Create service account
echo "Creating service account..."
gcloud iam service-accounts create medsim-bot-sa \
    --display-name="MedSim Bot Service Account"

# Grant necessary roles
echo "Granting IAM roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:medsim-bot-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:medsim-bot-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectViewer"

# Create and download service account key
echo "Creating service account key..."
gcloud iam service-accounts keys create medsim-bot-sa-key.json \
    --iam-account=medsim-bot-sa@$PROJECT_ID.iam.gserviceaccount.com

# Create Cloud Storage bucket for Vertex AI
echo "Creating Cloud Storage bucket..."
gsutil mb -l $REGION gs://$PROJECT_ID-vertex-ai

echo "Setup complete! Please add the following to your .env file:"
echo "GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/medsim-bot-sa-key.json"
echo "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
echo "VERTEX_LOCATION=$REGION"
