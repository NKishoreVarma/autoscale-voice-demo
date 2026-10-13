// Minimal route gate — recreated from the website's ProtectedRoute without the
// console logging and website-specific role hierarchy. This is a UI gate only;
// the backend independently authorizes every sensitive request.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Verifying credentials…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
