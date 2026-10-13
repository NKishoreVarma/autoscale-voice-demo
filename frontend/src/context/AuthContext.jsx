// Minimal auth context — recreated from the website's AuthContext but stripped of
// the client-side allowlist, Firestore role reads, verbose logging, and the
// insecure "grant super_admin on error" fallback. Authorization is enforced
// server-side; this context only manages sign-in state and the ID token.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase.js';
import { setTokenGetter } from '../lib/api.js';
import { isFirebaseConfigured } from '../lib/config.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    // The API client pulls a fresh ID token for each request.
    setTokenGetter(async () => {
      const u = auth.currentUser;
      return u ? u.getIdToken() : null;
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, setError, configured, loginWithEmail, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
