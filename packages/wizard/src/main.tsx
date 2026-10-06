import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource/big-shoulders-stencil-display/800';
import './index.css';
import { matchRoute } from './lib/router';

// The public landing page is what most first visits open, so it loads without the app's code (the
// runner connection, the plan editor, the report). Its links are page loads, which fetch the app.
const root = ReactDOM.createRoot(document.getElementById('root')!);
const Entry = matchRoute(window.location.pathname).name === 'landing' ? import('./LandingRoot') : import('./App');
void Entry.then(({ default: Page }) =>
  root.render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>
  )
);
