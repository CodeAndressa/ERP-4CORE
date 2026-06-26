import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// Apply theme class synchronously before first paint to avoid flash
const saved = localStorage.getItem('erp-theme');
document.documentElement.classList.remove('dark', 'light');
document.documentElement.classList.add(saved === 'light' ? 'light' : 'dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
