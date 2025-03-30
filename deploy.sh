#!/bin/bash

echo "BMV Quiz App - One-Click Deployment"
echo "===================================="

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the app
echo "Building the application..."
npm run build

# Database migration if needed
if [ ! -z "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npm run db:push
fi

# Start the application
echo "Starting the application..."
npm start

echo "Deployment complete! Your app should be running now."