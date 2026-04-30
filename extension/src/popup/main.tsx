import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/common/index.css';
import { Popup } from './Popup';

const el = document.getElementById('root')!;
createRoot(el).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
