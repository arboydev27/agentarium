import { createRoot } from 'react-dom/client';
import App from './App';
import { applyLookdev } from './lookdev';
import './style.css';
applyLookdev();
createRoot(document.getElementById('root')!).render(<App />);
