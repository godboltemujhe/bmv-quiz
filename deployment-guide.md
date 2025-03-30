# BMV Quiz App - Deployment Guide

## Overview

BMV Quiz App is a React/Express application for creating and taking quizzes. This guide will help you deploy the application to various platforms.

## Prerequisites

- Node.js 18+ installed
- Git installed (for GitHub deployment)
- npm or yarn package manager

## Quick Start

1. Extract the `deploy.zip` file to your local machine
2. Navigate to the extracted directory
3. Run the installation script:

```bash
# Using npm
npm install

# OR using yarn
yarn
```

4. Start the application:

```bash
# Using npm
npm run dev

# OR using yarn
yarn dev
```

5. Open your browser and navigate to `http://localhost:5000`

## Database Setup

This application uses PostgreSQL by default but can also work with in-memory storage.

### Using PostgreSQL:

1. Create a PostgreSQL database
2. Set the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgresql://username:password@hostname:port/database
```

3. Run database migrations:

```bash
npm run db:push
```

## GitHub Deployment

### Using GitHub Codespaces

1. Create a new repository on GitHub
2. Upload the contents of this folder to your repository
3. Open the repository in GitHub Codespaces
4. Run the application using the commands in Quick Start

### Using Vercel with GitHub

1. Push your code to a GitHub repository
2. Connect your GitHub account with Vercel
3. Import the repository in Vercel
4. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variables in Vercel project settings
6. Deploy!

## Environment Variables

The following environment variables can be configured:

- `DATABASE_URL`: PostgreSQL connection string (optional, falls back to in-memory storage)
- `PORT`: Port to run the server on (default: 5000)
- `NODE_ENV`: Environment setting (development/production)

## Troubleshooting

If you encounter issues:

1. **Database Connection Issues**: Verify your DATABASE_URL is correct and the database is accessible
2. **Port Conflicts**: Change the PORT environment variable if 5000 is already in use
3. **Build Errors**: Ensure you're using Node.js 18+ 

## Commands Reference

- `npm install`: Install dependencies
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run db:push`: Push database schema changes
- `npm start`: Start production server
