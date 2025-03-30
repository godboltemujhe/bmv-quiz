# BMV Quiz App - GitHub Pages Deployment Guide

This guide will help you deploy the BMV Quiz App to GitHub Pages so it's available online for free, indefinitely.

## Prerequisites

- GitHub account
- Git installed on your computer
- Node.js and npm installed

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account.
2. Click the "+" button in the top right and select "New repository".
3. Name your repository (e.g., `bmv-quiz`).
4. Choose "Public" visibility (GitHub Pages requires this for free accounts).
5. Click "Create repository".

## Step 2: Upload the Code

### Option 1: Using the provided script

1. Extract the `deploy.zip` file to a folder on your computer.
2. Open a terminal/command prompt in that folder.
3. Run:
   ```bash
   chmod +x github-push.sh
   ./github-push.sh
   ```
4. When prompted, enter your GitHub repository URL (e.g., `https://github.com/yourusername/bmv-quiz.git`).

### Option 2: Manual upload

1. Extract the `deploy.zip` file to a folder on your computer.
2. Open a terminal/command prompt in that folder.
3. Run the following Git commands:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/bmv-quiz.git
   git push -u origin main
   ```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub.
2. Click "Settings".
3. Scroll down to the "GitHub Pages" section.
4. Under "Source", select "GitHub Actions".
5. The deployment will start automatically due to the workflow file in the repository.

## Step 4: Access Your App

1. After the workflow completes (check the "Actions" tab), your app will be available at:
   `https://yourusername.github.io/bmv-quiz/`
2. The page will be publicly accessible and work just like the app in Replit.

## Customizing Your App

### Adding a Custom Domain

1. If you own a domain, you can set it up in the GitHub Pages settings.
2. Update the `CNAME` file in the `public` folder with your domain.

### Updating the App

To update your app in the future:

1. Make your changes locally.
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Updated app"
   git push
   ```
3. The GitHub Actions workflow will automatically deploy your updates.

## Troubleshooting

If you encounter issues:

1. Check the "Actions" tab in your GitHub repository to see if the deployment workflow succeeded.
2. Ensure your repository is public.
3. Make sure you've selected "GitHub Actions" as the source in GitHub Pages settings.
4. If the app shows a blank screen, check the browser console for errors (press F12).

For more help, refer to the [GitHub Pages documentation](https://docs.github.com/en/pages).

## Important Notes

- GitHub Pages only supports static websites, so the backend functionality is simulated on the client side.
- All quiz data is stored in localStorage in the browser.
- Your app will not have a real database, but all the frontend features will work as expected.
- The app will work offline and can be used as a PWA (Progressive Web App).