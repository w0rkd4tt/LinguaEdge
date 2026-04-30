import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/common/index.css';
import { Welcome } from './Welcome';

const el = document.getElementById('root')!;
createRoot(el).render(
  <React.StrictMode>
    <Welcome />
  </React.StrictMode>,
);
