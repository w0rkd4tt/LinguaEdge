import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/common/index.css';
import { Dashboard } from './Dashboard';

const el = document.getElementById('root')!;
createRoot(el).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
);
