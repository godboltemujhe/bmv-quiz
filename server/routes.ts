import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import express from "express";
import path from "path";
import { storage } from "./storage";
import { insertQuizSchema, syncQuizSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test static file routes - serve files from /public directory
  app.use('/test-static', express.static(path.join(process.cwd(), 'public')));
  
  // Direct route to test page for debugging
  app.get('/test-page', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'test.html'));
  });
  
  // URL info page to help with debugging
  app.get('/access-info', (req, res) => {
    const replOwner = process.env.REPL_OWNER || 'unknown';
    const replSlug = process.env.REPL_SLUG || 'workspace';
    const replId = process.env.REPL_ID || '';
    
    // Generate a simple HTML page with access information
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Application Access Info</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; background: #f8f9fa; padding: 20px; border-radius: 8px; }
          h1 { color: #333; }
          .url { font-weight: bold; padding: 10px; background: #e9ecef; border-radius: 4px; margin: 10px 0; }
          .info { margin-bottom: 20px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Application Access Information</h1>
          
          <div class="info">
            <p>Your application should be accessible at the following URL:</p>
            <div class="url">https://${replSlug}.${replOwner}.repl.co</div>
            
            <p>If you're seeing a DNS error, make sure you're using the URL above, not any other URL.</p>
          </div>
          
          <div class="info">
            <h2>Debug Information</h2>
            <p>Replit Owner: ${replOwner}</p>
            <p>Replit Slug: ${replSlug}</p>
            <p>Replit ID: ${replId}</p>
            <p>Request Host: ${req.hostname}</p>
            <p>Request URL: ${req.url}</p>
            <p>App Environment: ${req.app.get('env')}</p>
          </div>
          
          <a href="/test-page" class="button">Go to Test Page</a>
          <a href="/" class="button">Go to Main Application</a>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  });
  
  // Health check route
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'undefined',
      apiVersion: '1.0.0',
      hostname: req.hostname,
      path: req.path,
      appMode: app.get('env')
    });
  });
  
  // CREATE API routes
  
  // GET all public quizzes
  app.get("/api/quizzes", async (req: Request, res: Response) => {
    try {
      const quizzes = await storage.getPublicQuizzes();
      // Return the array directly, not wrapped in an object
      res.json(quizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      res.status(500).json({ message: "Failed to fetch quizzes" });
    }
  });
  
  // GET a specific quiz by ID
  app.get("/api/quizzes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const quiz = await storage.getQuiz(id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Return the quiz directly, not wrapped in an object
      res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz:", error);
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });
  
  // GET a quiz by its unique ID (for cross-device sync)
  app.get("/api/quizzes/unique/:uniqueId", async (req: Request, res: Response) => {
    try {
      const uniqueId = req.params.uniqueId;
      const quiz = await storage.getQuizByUniqueId(uniqueId);
      
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Return the quiz directly, not wrapped in an object
      res.json(quiz);
    } catch (error) {
      console.error("Error fetching quiz by unique ID:", error);
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });
  
  // CREATE a new quiz
  app.post("/api/quizzes", async (req: Request, res: Response) => {
    try {
      // Validate the request body against our schema
      const quizData = insertQuizSchema.parse(req.body);
      
      const quiz = await storage.createQuiz(quizData);
      // Return the quiz directly, not wrapped in an object
      res.status(201).json(quiz);
    } catch (error) {
      console.error("Error creating quiz:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid quiz data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });
  
  // UPDATE a quiz
  app.put("/api/quizzes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      // Partial validation for update
      const quizData = insertQuizSchema.partial().parse(req.body);
      
      const updatedQuiz = await storage.updateQuiz(id, quizData);
      if (!updatedQuiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      // Return the quiz directly, not wrapped in an object
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error updating quiz:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid quiz data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to update quiz" });
    }
  });
  
  // DELETE a quiz
  app.delete("/api/quizzes/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid quiz ID" });
      }
      
      const success = await storage.deleteQuiz(id);
      if (!success) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });
  
  // SYNC quizzes across devices
  app.post("/api/quizzes/sync", async (req: Request, res: Response) => {
    try {
      // Validate the sync request body
      const syncData = syncQuizSchema.parse(req.body);
      
      // Process the quizzes to sync
      const syncedQuizzes = await storage.syncQuizzes(syncData.quizzes);
      
      // Return all synced quizzes
      const allQuizzes = await storage.getPublicQuizzes();
      
      // Return just the array of all quizzes, the client doesn't need to distinguish between synced and existing
      res.json(allQuizzes);
    } catch (error) {
      console.error("Error syncing quizzes:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid sync data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to sync quizzes" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
