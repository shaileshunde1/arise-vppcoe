import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import DiagnosticQuiz from './pages/DiagnosticQuiz';
import StudentDashboard from './pages/StudentDashboard';
import LabCatalog from './pages/LabCatalog';
import LabSimulator from './pages/LabSimulator';
import LabJournal from './pages/LabJournal';
import Leaderboard from './pages/Leaderboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ProfilePage from './pages/ProfilePage';

import ProtectedRoute from './components/ProtectedRoute';
import AuthenticatedLayout from './layouts/AuthenticatedLayout';
import MainLayout from './layouts/MainLayout';
import ErrorPopup from './components/common/ErrorPopup';

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

function RootRedirect() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
      setChecking(false);
    });
  }, []);

  if (checking) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function App() {
  return (
    <>
      <Router>
        <ErrorPopup />
        <Routes>
          {/* Public */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth */}
          <Route element={<MainLayout />}>
            <Route path="auth" element={<AuthPage />} />
          </Route>

          {/* OAuth callback — public, no layout, no auth guard */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* LabSimulator: protected but NO layout wrapper — it is full-screen itself */}
          <Route element={<ProtectedRoute />}>
            <Route path="/labs/:experimentId" element={<LabSimulator />} />
            <Route path="/quiz" element={<DiagnosticQuiz />} />
          </Route>

          {/* All other protected routes — with AuthenticatedLayout navbar */}
          <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/labs" element={<LabCatalog />} />
            <Route path="/journal" element={<LabJournal />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={
            <div className="h-screen flex items-center justify-center text-white">
              <h1 className="text-4xl font-heading">404 - Laboratory Not Found</h1>
            </div>
          } />
        </Routes>
      </Router>
    </>
  );
}

export default App;