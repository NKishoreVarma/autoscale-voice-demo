// Auth context. Manages Firebase sign-in state and the ID token. Authorization is
// enforced server-side (admin allowlist); this only handles identity + tokens.
// Email verification is REQUIRED (the backend rejects unverified emails); we expose
// helpers to send a verification email and to refresh state/token after verifying.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase.js';
import { setTokenProviders } from '../lib/api.js';
import { isFirebaseConfigured } from '../lib/config.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    // API client pulls a cached token normally, and can force-refresh on 401.
    setTokenProviders({
      get: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
      refresh: async () => (auth.currentUser ? auth.currentUser.getIdToken(true) : null),
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setEmailVerified(!!u?.emailVerified);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    setEmailVerified(!!cred.user.emailVerified);
    return cred.user;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    setEmailVerified(!!cred.user.emailVerified);
    return cred.user;
  }, []);

  const sendVerification = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  // Re-check verification after the user clicks the email link; force a fresh token
  // so the backend sees email_verified = true.
  const refreshVerification = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const verified = !!auth.currentUser.emailVerified;
    setEmailVerified(verified);
    setUser(auth.currentUser);
    return verified;
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
    setEmailVerified(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        emailVerified,
        loading,
        configured,
        loginWithEmail,
        loginWithGoogle,
        sendVerification,
        refreshVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
