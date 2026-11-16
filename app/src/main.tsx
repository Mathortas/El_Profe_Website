import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import Styleguide from './styleguide/Styleguide';

// Por ahora la app muestra la guía del sistema de diseño.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Styleguide />
  </StrictMode>,
);
