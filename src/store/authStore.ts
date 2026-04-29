import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { signInWithCustomToken, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import api from '../lib/api.ts';

interface CustomUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

interface AuthState {
  user: FirebaseUser | null;
  customUser: CustomUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  initialize: () => () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  customUser: null,
  status: 'idle',
  initialize: () => {
    set({ status: 'loading' });
    
    // Auth state observer handles the lifecycle
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
         try {
           const res = await api.get('/api/auth/me');
           set({ user, customUser: res.data.user, status: 'authenticated' });
         } catch {
           set({ user, customUser: null, status: 'unauthenticated' });
         }
      } else {
         set({ user: null, customUser: null, status: 'unauthenticated' });
      }
    });

    return unsubscribe;
  },
  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      const res = await api.post('/api/auth/google', { firebaseIdToken: idToken });
      
      const { user, firebaseToken } = res.data;
      set({ customUser: user });

      // Usually signInWithPopup already auths firebase SDK, but doing it with our issued custom token guarantees 
      // everything aligns with our backend custom token logic.
      await signInWithCustomToken(auth, firebaseToken);
    } catch (error) {
      console.error('Google sign in error', error);
      throw error;
    }
  },
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      console.error(e);
    }
    await signOut(auth);
    set({ customUser: null, user: null, status: 'unauthenticated' });
  },
}));
