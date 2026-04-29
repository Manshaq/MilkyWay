import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { Loader2, Milk, AlertCircle } from 'lucide-react';

// Custom Google Icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      if (err && typeof err === 'object') {
        if ('code' in err && err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          setError('Sign-in popup was closed. If you are having trouble, try opening the app in a new tab.');
        } else if ('code' in err && err.code === 'auth/popup-blocked') {
          setError('Popup blocked by browser. Please open the app in a new tab using the icon in the top right corner.');
        } else {
          setError(err.response?.data?.error || err.message || 'Access Denied: Google sign in failed');
        }
      } else {
        setError('Access Denied: Google sign in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Cinematic Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#4f46e5]/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-6 lg:p-14 relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-8 transform hover:scale-110 transition-transform duration-500">
            <Milk className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight leading-tight text-center">Welcome Back</h1>
          <p className="text-slate-500 font-medium mt-3 text-center text-lg">Sign in to your account with Google</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-center gap-4 text-rose-400 text-sm font-semibold mb-8"
          >
            <AlertCircle size={20} />
            {error}
          </motion.div>
        )}

        <div className="mt-4">
          <button
            disabled={googleLoading}
            onClick={handleGoogleLogin}
            type="button"
            className="w-full bg-white hover:bg-gray-100 text-slate-800 flex items-center justify-center py-4 px-6 rounded-2xl transition-all shadow-xl font-bold border border-slate-200"
          >
            {googleLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" /> : <GoogleIcon />}
            <span className="text-base font-bold">Sign in with Google</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
