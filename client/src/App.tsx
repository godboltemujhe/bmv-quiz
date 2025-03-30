import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import QuizApp from "@/pages/Quiz";
import { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Error boundary component
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#fff', 
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      margin: '20px auto',
      maxWidth: '600px'
    }}>
      <h2 style={{ color: '#e11d48', marginTop: 0 }}>Something went wrong</h2>
      <p style={{ marginBottom: '20px' }}>
        There was an error loading the application:
      </p>
      <pre style={{ 
        background: '#f5f5f5', 
        padding: '10px', 
        borderRadius: '4px',
        overflowX: 'auto',
        fontSize: '14px'
      }}>
        {error.message}
      </pre>
      <button 
        onClick={() => window.location.reload()} 
        style={{
          marginTop: '20px',
          padding: '8px 16px',
          backgroundColor: '#0f766e',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Refresh Page
      </button>
    </div>
  );
}

function Router() {
  console.log('Router component rendering');
  return (
    <Switch>
      <Route path="/" component={QuizApp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log('App component rendering');
  
  const [error, setError] = useState<Error | null>(null);
  const [healthCheck, setHealthCheck] = useState<{status: string, details?: Record<string, any>}>({
    status: 'checking'
  });
  
  // Report when App component mounts
  useEffect(() => {
    console.log('App component mounted');
    
    // Hide the initial loading screen if it exists
    const initialLoading = document.getElementById('initial-loading');
    if (initialLoading) {
      initialLoading.classList.add('hidden');
    }
    
    // Update debug info with health check information
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
      debugInfo.textContent = 'React app loaded. Checking API...';
    }
    
    // Check if API is accessible
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error(`API health check failed with status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('API health check succeeded:', data);
        setHealthCheck({ status: 'healthy', details: data });
        
        if (debugInfo) {
          debugInfo.textContent = 'React app loaded. API is healthy.';
          debugInfo.style.background = 'rgba(0, 150, 0, 0.7)';
          // Hide it after 5 seconds
          setTimeout(() => {
            debugInfo.classList.add('hidden');
          }, 5000);
        }
      })
      .catch(err => {
        console.error('API health check failed:', err);
        setHealthCheck({ status: 'error', details: { error: err.message } });
        
        if (debugInfo) {
          debugInfo.textContent = `React app loaded. API error: ${err.message}`;
          debugInfo.style.background = 'rgba(200, 0, 0, 0.8)';
        }
      });
    
    // Add a class to body to indicate React is loaded
    document.body.classList.add('react-loaded');
    
    return () => {
      console.log('App component unmounting');
    };
  }, []);
  
  // Global error handling
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      setError(event.error || new Error('Unknown application error'));
      event.preventDefault();
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  // If there was an error, show the error fallback
  if (error) {
    return <ErrorFallback error={error} />;
  }
  
  // Debug Banner Component - shown when health check has issues
  const DebugBanner = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    
    // Only show for error status or during checking
    if (healthCheck.status === 'healthy' || !isVisible) {
      return null;
    }
    
    const correctUrl = window.location.hostname.includes('repl.co') 
      ? window.location.origin 
      : 'https://workspace.bdawpll.repl.co';
      
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '10px 20px',
        backgroundColor: healthCheck.status === 'checking' ? '#2563eb' : '#e11d48',
        color: 'white',
        fontSize: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Application Status: {healthCheck.status}</strong>
            {healthCheck.status === 'error' && (
              <div>
                <p>
                  If you're seeing DNS errors, try accessing the app at: 
                  <a 
                    href={correctUrl}
                    style={{ color: 'white', textDecoration: 'underline', marginLeft: '5px', fontWeight: 'bold' }}
                  >
                    {correctUrl}
                  </a>
                </p>
              </div>
            )}
          </div>
          <div>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            <button 
              onClick={() => setIsVisible(false)}
              style={{
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
        
        {showDetails && healthCheck.details && (
          <div style={{
            marginTop: '10px',
            padding: '10px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap'
          }}>
            <p>Debug Information:</p>
            <div>Current URL: {window.location.href}</div>
            <div>Correct URL: {correctUrl}</div>
            <div>API Details: {JSON.stringify(healthCheck.details, null, 2)}</div>
            <div style={{ marginTop: '10px' }}>
              <a 
                href="/access-info"
                target="_blank"
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                View Access Info Page
              </a>
              {' | '}
              <a 
                href="/test-page"
                target="_blank"
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                View Test Page
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  try {
    return (
      <ThemeProvider defaultTheme="light" storageKey="bmv-quiz-theme">
        <QueryClientProvider client={queryClient}>
          <DebugBanner />
          <Router />
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    );
  } catch (err) {
    console.error('Error rendering App:', err);
    setError(err instanceof Error ? err : new Error(String(err)));
    return <ErrorFallback error={err instanceof Error ? err : new Error(String(err))} />;
  }
}

export default App;
