import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.ts';
import { CloudSyncService } from './services/syncService.ts';

import { Milk } from 'lucide-react';

// Pages
import Dashboard from './components/dashboard/Dashboard.tsx';
import Login from './components/auth/Login.tsx';
import SupplierList from './components/suppliers/SupplierList.tsx';
import MilkCollection from './components/collection/MilkCollection.tsx';
import Layout from './components/layout/Layout.tsx';

import Reports from './components/reports/Reports.tsx';

import SettingsPage from './components/settings/Settings.tsx';
import AgentManagement from './components/agents/AgentManagement.tsx';

export default function App() {
  const { initialize, status } = useAuthStore();

  useEffect(() => {
    const unsub = initialize();
    return () => {
      if (unsub) unsub();
    };
  }, [initialize]);

  useEffect(() => {
    if (status === 'authenticated') {
      CloudSyncService.startLiveSync();
    } else {
      CloudSyncService.stopLiveSync();
    }
    return () => {
      CloudSyncService.stopLiveSync();
    };
  }, [status]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-indigo-500/30">
        <Routes>
          <Route path="/login" element={status === 'loading' ? <SystemLoading /> : status === 'authenticated' ? <Navigate to="/" /> : <Login />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><SupplierList /></ProtectedRoute>} />
            <Route path="/collection" element={<ProtectedRoute><MilkCollection /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentManagement /></ProtectedRoute>} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function SystemLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-8" />
        <div className="absolute inset-0 flex items-center justify-center">
           <Milk size={20} className="text-indigo-400" />
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 animate-pulse">Initializing System</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuthStore();
  if (status === 'loading') return <SystemLoading />;
  if (!user || status !== 'authenticated') return <Navigate to="/login" />;
  return <>{children}</>;
}
