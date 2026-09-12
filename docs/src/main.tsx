import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Docs from './pages/Docs';
import VersionedDocs from './pages/VersionedDocs';
import Status from './pages/Status';
import Examples from './pages/Examples';
import About from './pages/About';
import License from './pages/License';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="docs" element={<Docs />} />
          <Route path="docs/:version" element={<VersionedDocs />} />
          <Route path="docs/:version/:section" element={<VersionedDocs />} />
          <Route path="examples" element={<Examples />} />
          <Route path="status" element={<Status />} />
          <Route path="about" element={<About />} />
          <Route path="license" element={<License />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
