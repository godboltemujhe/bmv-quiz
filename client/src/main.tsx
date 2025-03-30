import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Log that main.tsx has started running
console.log('main.tsx is executing at:', new Date().toISOString());

try {
  // Get the root element
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found. Make sure there is a div with id 'root' in the HTML.");
  }
  
  console.log('Creating React root...');
  
  // Create the root and render the App
  const root = createRoot(rootElement);
  
  console.log('Rendering App component...');
  root.render(<App />);
  
  console.log('React root render completed');
} catch (error) {
  console.error('Error rendering React application:', error);
  
  // Display a user-friendly error message
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo) {
    debugInfo.textContent = `React Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    debugInfo.style.background = 'rgba(200, 0, 0, 0.8)';
  }
  
  // Also try to update the loading message
  const loadingElem = document.getElementById('initial-loading');
  if (loadingElem) {
    const heading = document.createElement('h3');
    heading.style.color = 'red';
    heading.textContent = 'Error Starting Application';
    
    const errorMsg = document.createElement('p');
    errorMsg.textContent = error instanceof Error 
      ? `Error: ${error.message}` 
      : 'An unknown error occurred while starting the application.';
    
    // Add a refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh Page';
    refreshBtn.style.padding = '8px 16px';
    refreshBtn.style.margin = '10px 0';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.onclick = () => window.location.reload();
    
    // Clear and append new content
    loadingElem.innerHTML = '';
    loadingElem.appendChild(heading);
    loadingElem.appendChild(errorMsg);
    loadingElem.appendChild(refreshBtn);
  }
}
