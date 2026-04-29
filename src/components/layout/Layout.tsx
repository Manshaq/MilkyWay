import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Milk, Settings, Bell, Search, LogOut, BarChart2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { CloudSyncService } from '../../services/syncService.ts';

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div className={cn(
          "flex items-center gap-4 px-6 py-4 rounded-[1.5rem] transition-all duration-500 group relative truncate",
          isActive 
            ? "bg-white/5 border border-white/10 text-white shadow-[0_0_30px_rgba(99,102,241,0.1)]" 
            : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
        )}>
          {isActive && (
            <motion.div 
              layoutId="nav-active"
              className="absolute left-2 w-1 h-6 bg-indigo-500 rounded-full"
            />
          )}
          <span className={cn("transition-all group-hover:scale-110", isActive ? "text-indigo-400" : "opacity-60")}>
            {icon}
          </span>
          <span className="font-semibold text-sm tracking-wide">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function MobileNavItem({ to, icon }: { to: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "p-3 rounded-[1.2rem] transition-all",
        isActive ? "text-indigo-400 bg-white/5 shadow-inner" : "text-slate-500"
      )}
    >
      {icon}
    </NavLink>
  );
}

export default function Layout() {
  const { user, customUser, logout: clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = async () => {
    await clearAuth();
    navigate('/login');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await CloudSyncService.syncAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Cinematic Sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-screen p-5 lg:p-8 gap-6 lg:gap-12 bg-black/40 backdrop-blur-[40px] border-r border-white/5 z-40">
        <div className="flex items-center gap-4 px-2">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Milk className="text-white w-7 h-7" />
          </div>
          <span className="text-2xl font-display font-bold tracking-tight text-white mb-[-2px]">MilkyWay</span>
        </div>

        <nav className="flex-1 flex flex-col gap-3">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/suppliers" icon={<Users size={20} />} label="Suppliers" />
          <NavItem to="/collection" icon={<Milk size={20} />} label="Milk Records" />
          <NavItem to="/reports" icon={<BarChart2 size={20} />} label="Reports" />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
          {customUser?.role === 'ADMIN' && (
             <NavItem to="/agents" icon={<Shield size={20} />} label="Users" />
          )}
        </nav>

        <div className="glass-panel p-6 mt-auto">
          <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
              {user?.displayName?.[0] || user?.email?.[0] || '?'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate mb-0.5">{user?.displayName || user?.email}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{customUser?.role === 'ADMIN' ? 'ADMIN' : 'AGENT'}</p>
            </div>
            <button 
              onClick={handleLogout} 
              className="ml-auto p-2 text-slate-600 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <LogOut size={18} />
            </button>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full btn-glossy !py-3 !text-[11px] !rounded-[1.2rem] flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Syncing...
              </>
            ) : 'Sync Cloud'}
          </button>
        </div>
      </aside>

      {/* Main Surface */}
      <main className="flex-1 flex flex-col relative pb-32 md:pb-0 overflow-hidden bg-transparent">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto">
           <Outlet />
        </div>

        {/* Mobile Navigation Bar */}
        <nav className="md:hidden fixed bottom-8 left-8 right-8 h-20 glass-panel !rounded-[2.5rem] px-8 flex items-center justify-between z-50">
          <MobileNavItem to="/" icon={<LayoutDashboard size={24} />} />
          <MobileNavItem to="/reports" icon={<BarChart2 size={24} />} />
          <div className="relative -top-10">
            <NavLink 
              to="/collection" 
              className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-[0_12px_40px_rgba(99,102,241,0.4)] border-[6px] border-[#08080c] active:scale-90 transition-transform"
            >
              <Milk className="text-white w-7 h-7" />
            </NavLink>
          </div>
          <MobileNavItem to="/suppliers" icon={<Users size={24} />} />
          <div className="relative">
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="w-10 h-10 rounded-[1rem] bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-500 active:scale-95 transition-transform"
            >
               {user?.displayName?.[0] || user?.email?.[0] || '?'}
            </button>

            <AnimatePresence>
              {showMobileMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-14 right-0 min-w-[200px] glass-panel p-2 shadow-2xl flex flex-col gap-1 z-50 origin-bottom-right"
                >
                  <div className="px-4 py-3 border-b border-white/5 mb-1">
                    <p className="text-xs font-bold text-white truncate">{user?.displayName || user?.email}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{customUser?.role === 'ADMIN' ? 'ADMIN' : 'AGENT'}</p>
                  </div>
                  {customUser?.role === 'ADMIN' && (
                    <button 
                      onClick={() => { setShowMobileMenu(false); navigate('/agents'); }}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all w-full text-left"
                    >
                      <Shield size={18} /> Manage Users
                    </button>
                  )}
                  <button 
                    onClick={() => { setShowMobileMenu(false); navigate('/settings'); }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all w-full text-left"
                  >
                    <Settings size={18} /> App Settings
                  </button>
                  <button 
                    onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all w-full text-left"
                  >
                    <LogOut size={18} /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </main>
    </div>
  );
}
