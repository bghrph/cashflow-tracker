import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initPwaUpdate } from './lib/pwaUpdate.js';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/components.css';

initPwaUpdate();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
