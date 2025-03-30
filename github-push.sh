#!/bin/bash

# This script helps you quickly push your code to GitHub
# Make this script executable with: chmod +x github-push.sh

echo "BMV Quiz App - GitHub Push Utility"
echo "=================================="

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install Git first."
    exit 1
fi

# Ask for GitHub repository URL
echo -n "Enter your GitHub repository URL (or create a new one): "
read REPO_URL

# Check if git is already initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
fi

# Add all files
echo "Adding files to git..."
git add .

# Commit changes
echo -n "Enter commit message (default: 'Initial commit'): "
read COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Initial commit"
fi

git commit -m "$COMMIT_MSG"

# Add remote if not already added
if [ -z "$(git remote -v)" ]; then
    if [ -z "$REPO_URL" ]; then
        echo "ERROR: No repository URL provided."
        exit 1
    fi
    
    echo "Adding remote repository..."
    git remote add origin $REPO_URL
fi

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin master || git push -u origin main

echo "Done! Your code should now be on GitHub."
echo "Visit your repository URL to verify: $REPO_URL"