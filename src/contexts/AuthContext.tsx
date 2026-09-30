import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, onAuthStateChanged, signOut, type User, isFirebaseConfigured } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isPinVerified: boolean;
  setIsPinVerified: (v: boolean) => void;
  demoLogin: (email?: string, name?: string) => void;
  isFirebaseLive: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isPinVerified: false,
  setIsPinVerified: () => {},
  demoLogin: () => {},
  isFirebaseLive: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const isFirebaseLive = isFirebaseConfigured();

  useEffect(() => {
    // Check local storage for persistent demo user if Firebase is not active
    const savedDemo = localStorage.getItem('pg_demo_user');
    if (!isFirebaseLive && savedDemo) {
      try {
        setUser(JSON.parse(savedDemo));
      } catch (e) {
        localStorage.removeItem('pg_demo_user');
      }
    }

    if (isFirebaseLive) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        if (!firebaseUser) setIsPinVerified(false);
      });
      return unsubscribe;
    } else {
      setLoading(false);
    }
  }, [isFirebaseLive]);

  const demoLogin = (email = 'owner@phoneguard.app', name = 'Phone Owner') => {
    const mockUser = {
      uid: 'pg_owner_01',
      email,
      displayName: name,
    } as unknown as User;
    setUser(mockUser);
    localStorage.setItem('pg_demo_user', JSON.stringify(mockUser));
  };

  const logout = async () => {
    if (isFirebaseLive) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Firebase signOut error', e);
      }
    }
    setUser(null);
    localStorage.removeItem('pg_demo_user');
    setIsPinVerified(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      logout,
      isPinVerified,
      setIsPinVerified,
      demoLogin,
      isFirebaseLive
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
