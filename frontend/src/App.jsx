import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/AppShell.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import StartCall from './pages/StartCall.jsx';
import History from './pages/History.jsx';
import CallDetail from './pages/CallDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Overview />} />
        <Route path="/start" element={<StartCall />} />
        <Route path="/calls" element={<History />} />
        <Route path="/calls/:id" element={<CallDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
