import React from 'react';
import { motion } from 'motion/react';
import { Building2, Save, User, Bell, Shield, Wallet } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Settings() {
  const { user } = useAuthStore();

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Settings</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Manage company details, preferences, and security.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-12">
        <div className="xl:col-span-1 space-y-6">
          <nav className="flex flex-col space-y-2">
             <button className="flex items-center gap-4 px-6 py-5 rounded-[1.5rem] bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold transition-all w-full text-left">
               <Building2 size={20} /> Company Profile
             </button>
             <button className="flex items-center gap-4 px-6 py-5 rounded-[1.5rem] hover:bg-white/[0.03] text-slate-400 font-bold transition-all w-full text-left">
               <User size={20} /> Agent Account
             </button>
             <button className="flex items-center gap-4 px-6 py-5 rounded-[1.5rem] hover:bg-white/[0.03] text-slate-400 font-bold transition-all w-full text-left">
               <Shield size={20} /> Security & Integrity
             </button>
          </nav>
        </div>

        <div className="xl:col-span-2 space-y-10">
          <div className="glass-panel p-6 lg:p-10">
            <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Company Profile</h2>
            <form className="space-y-6 lg:space-y-8" onSubmit={e => e.preventDefault()}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                 <div className="space-y-3">
                   <label className="section-label ml-2">Company Name</label>
                   <input type="text" defaultValue="MilkyWay Dairy Ltd." className="cinematic-input w-full font-bold" />
                 </div>
                 <div className="space-y-3">
                   <label className="section-label ml-2">Registration ID</label>
                   <input type="text" defaultValue="RC-83921" className="cinematic-input w-full font-bold" />
                 </div>
               </div>
               
               <div className="space-y-3">
                 <label className="section-label ml-2">Headquarters Address</label>
                 <input type="text" defaultValue="Plot 14, Industrial Estate, Kaduna" className="cinematic-input w-full font-bold" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                 <div className="space-y-3">
                   <label className="section-label ml-2">Support Email</label>
                   <input type="email" defaultValue={user?.email || 'admin@milkyway.com'} className="cinematic-input w-full font-bold" />
                 </div>
                 <div className="space-y-3">
                   <label className="section-label ml-2">Support Phone</label>
                   <input type="text" defaultValue="+234 800 000 0000" className="cinematic-input w-full font-bold" />
                 </div>
               </div>

               <div className="pt-6 border-t border-white/5 mt-8">
                 <button className="btn-glossy px-8 h-14 flex items-center justify-center gap-3">
                   <Save size={18} />
                   <span>Save Changes</span>
                 </button>
               </div>
            </form>
          </div>

          <div className="glass-panel p-6 lg:p-10">
             <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Financial Defaults</h2>
             <div className="space-y-6 lg:space-y-8">
               <div className="space-y-3">
                 <label className="section-label ml-2">Default Milk Price (NGN/Liter)</label>
                 <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                   <input type="number" defaultValue="750" className="cinematic-input w-full !pl-14 font-bold max-w-sm" />
                 </div>
                 <p className="text-sm font-medium text-slate-500 ml-2 mt-2">This is the default price auto-filled during new collections.</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
