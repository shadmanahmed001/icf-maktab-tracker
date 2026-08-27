/**
 * Entry point for the static demo bundle.
 *
 * Identical to the real client except for two things: hash routing, because a
 * single-file page has no server to resolve paths against, and a banner making
 * the demo's nature explicit. The API is swapped for the fixture-backed client
 * by an alias in the demo build config.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { DemoBanner } from './demo/DemoBanner.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DemoBanner />
    <App Router={HashRouter} />
  </StrictMode>
);
