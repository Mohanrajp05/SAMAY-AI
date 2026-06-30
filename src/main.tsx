import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully suppress benign internal Firestore SDK BloomFilter warnings/errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const isBloomFilterError = args.some(
    arg => typeof arg === "string" && (arg.includes("BloomFilterError") || arg.includes("BloomFilter error"))
  );
  if (isBloomFilterError) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  const isBloomFilterWarn = args.some(
    arg => typeof arg === "string" && (arg.includes("BloomFilterError") || arg.includes("BloomFilter error"))
  );
  if (isBloomFilterWarn) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
