import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useAppStore } from './stores/appStore';

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

async function bootstrap() {
  // The saved settings must be in the store before the first render: startup code (plugin loading,
  // the welcome modal) reads them, and writing before they are loaded would replace them with defaults.
  try {
    await useAppStore.persist.rehydrate();
  } catch (err) {
    console.error('Failed to load saved settings; starting with defaults:', err);
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
