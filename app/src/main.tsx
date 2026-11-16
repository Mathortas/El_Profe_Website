import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import './design';
import App from './app/App';
import Styleguide from './styleguide/Styleguide';

// El sistema de diseño sigue disponible en /#guia para revisar componentes.
const Root = location.hash === '#guia' ? Styleguide : App;
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
