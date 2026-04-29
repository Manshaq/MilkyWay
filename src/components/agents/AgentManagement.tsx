import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../../lib/api.ts';
import { Shield, Mail, Calendar, Key, AlertTriangle, Users, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.ts';

export default function AgentManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const { customUser } = useAuthStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/users');
      setUsers(res.data.users || []);
    } catch (e) {
      setError(e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.error || 'Failed to fetch users' : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (id === customUser?.id) {
       alert("You cannot change your own status from here.");
       return;
    }
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setUpdating(id);
      await api.put(`/api/admin/users/${id}/status`, { status: newStatus });
      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    } catch (e) {
       alert(e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.error || 'Failed to update user status' : 'Failed to update user status');
    } finally {
      setUpdating(null);
    }
  };

  const toggleRole = async (id: string, currentRole: string) => {
    if (id === customUser?.id) {
       alert("You cannot change your own primary role from here.");
       return;
    }
    const newRole = currentRole === 'ADMIN' ? 'AGENT' : 'ADMIN';
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    try {
      setUpdating(id);
      await api.put(`/api/admin/users/${id}/status`, { role: newRole });
      setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
    } catch (e) {
       alert(e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.error || 'Failed to update user role' : 'Failed to update user role');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
     return <div className="p-6 lg:p-10 text-white flex items-center gap-3"><Loader2 className="animate-spin" /> Fetching agent accounts...</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-8 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Agent Accounts</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Manage system personnel, roles, and access security.</p>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      <div className="glass-panel p-2">
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-wider">Agent Details</th>
                  <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                  <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="p-6 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${u.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                           <Users size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-white">{u.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm font-semibold">
                            <Mail size={14} /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 font-bold uppercase tracking-widest text-xs">
                       <span className={`px-3 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-300 border border-white/10'}`}>
                          {u.role}
                       </span>
                    </td>
                    <td className="p-6 text-slate-400 font-semibold align-middle">
                      <div className="flex items-center gap-2 text-sm">
                         <Calendar size={16} />
                         {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="p-6">
                       <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${u.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`}></span>
                          {u.status || 'ACTIVE'}
                       </span>
                    </td>
                    <td className="p-6 text-right whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           disabled={updating === u.id || u.id === customUser?.id}
                           onClick={() => toggleRole(u.id, u.role)}
                           title="Toggle Role" 
                           className={`p-2 rounded-xl transition-all ${u.id === customUser?.id ? 'opacity-30 cursor-not-allowed text-slate-600' : 'hover:bg-white/10 text-slate-400 hover:text-indigo-400'}`}
                         >
                           <Shield size={20} />
                         </button>
                         <button 
                           disabled={updating === u.id || u.id === customUser?.id}
                           onClick={() => toggleStatus(u.id, u.status || 'ACTIVE')}
                           title={u.status === 'ACTIVE' ? 'Deactivate Agent' : 'Activate Agent'}
                           className={`p-2 rounded-xl transition-all ${u.id === customUser?.id ? 'opacity-30 cursor-not-allowed text-slate-600' : u.status === 'ACTIVE' ? 'hover:bg-rose-500/10 text-slate-400 hover:text-rose-400' : 'hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400'}`}
                         >
                           {u.status === 'ACTIVE' ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && !loading && (
              <div className="p-12 text-center text-slate-500 font-semibold">
                No users found.
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
