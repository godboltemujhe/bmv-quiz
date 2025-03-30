import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Debugging route
app.get('/debug-info', (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'undefined',
    headers: req.headers,
    appMode: app.get('env'),
    hostname: req.hostname,
    url: req.url,
    path: req.path,
    method: req.method,
    protocol: req.protocol,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    pid: process.pid
  };
  
  res.json(debugInfo);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Add error handling for the case where the port is already in use
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Trying to forcefully claim the port...`);
      
      // Force close the port and try again
      server.close();
      setTimeout(() => {
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        }, () => {
          log(`Successfully serving on port ${port}`);
        });
      }, 1000);
    } else {
      log(`Server error: ${error.message}`);
    }
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Log possible URLs to help with debugging
    const replOwner = process.env.REPL_OWNER || 'unknown';
    const replSlug = process.env.REPL_SLUG || 'workspace';
    const replId = process.env.REPL_ID || '';
    
    log(`Application should be accessible at:`);
    log(`- Local: http://localhost:${port}`);
    log(`- Replit: https://${replSlug}.${replOwner}.repl.co`);
    
    if (replId) {
      log(`Replit ID: ${replId}`);
    }
  });
})();
