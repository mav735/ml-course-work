import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Draw from './pages/Draw.jsx';
import Train from './pages/Train.jsx';
import Moderate from './pages/Moderate.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900">
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/draw" element={<Draw />} />
        <Route path="/train" element={<Train />} />
        <Route path="/moderate" element={<Moderate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
