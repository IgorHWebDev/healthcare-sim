#!/bin/bash

# Database connection details
DB_HOST="34.165.76.229"
DB_PORT="5432"
DB_NAME="mimic4-demo-db"
DB_SUPERUSER="postgres"

# Read the superuser password
echo "Enter PostgreSQL superuser (postgres) password:"
read -s PGPASSWORD
export PGPASSWORD

# Run the schema SQL
echo "Creating schema and granting permissions..."
psql -h $DB_HOST -p $DB_PORT -U $DB_SUPERUSER -d $DB_NAME -f server/database/schema.sql

# Run the initialization SQL
echo "Initializing database with sample data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_SUPERUSER -d $DB_NAME -f server/database/init.sql

# Clean up
unset PGPASSWORD

echo "Database setup complete!"
