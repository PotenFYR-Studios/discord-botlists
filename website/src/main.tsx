import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Docs from './pages/Docs';
import VersionedDocs from './pages/VersionedDocs';
import Status from './pages/Status';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="docs" element={<Docs />} />
          <Route path="docs/:version" element={<VersionedDocs />} />
          <Route path="docs/:version/:section" element={<VersionedDocs />} />
          <Route path="status" element={<Status />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
