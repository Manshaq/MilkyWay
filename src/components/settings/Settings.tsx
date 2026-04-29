import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Save, User, Shield, CheckCircle2, CreditCard } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const SETTINGS_KEY = 'milkyway-settings';

interface SettingsForm {
  companyName: string;
  registrationId: string;
  address: string;
  supportEmail: string;
  supportPhone: string;
  defaultMilkPrice: string;
}

function getDefaults(email?: string | null): SettingsForm {
  return {
    companyName: 'MilkyWay Dairy Ltd.',
    registrationId: 'RC-83921',
    address: 'Plot 14, Industrial Estate, Kaduna',
    supportEmail: email || 'admin@milkyway.com',
    supportPhone: '+234 800 000 0000',
    defaultMilkPrice: '750',
  };
}

type Tab = 'company' | 'account' | 'security';

export default function Settings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<SettingsForm>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? JSON.parse(stored) : getDefaults(user?.email);
    } catch {
      return getDefaults(user?.email);
    }
  });

  const update = (key: keyof SettingsForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const navItems: { tab: Tab; icon: React.ReactNode; label: string }[] = [
    { tab: 'company', icon: <Building2 size={20} />, label: 'Company Profile' },
    { tab: 'account', icon: <User size={20} />, label: 'Agent Account' },
    { tab: 'security', icon: <Shield size={20} />, label: 'Security & Integrity' },
  ];

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
            {navItems.map(({ tab, icon, label }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-4 px-6 py-5 rounded-[1.5rem] font-bold transition-all w-full text-left ${
                  activeTab === tab
                    ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400'
                    : 'hover:bg-white/[0.03] text-slate-400'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="xl:col-span-2 space-y-10">
          {activeTab === 'company' && (
            <div className="glass-panel p-6 lg:p-10">
              <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Company Profile</h2>
              <form className="space-y-6 lg:space-y-8" onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                  <div className="space-y-3">
                    <label className="section-label ml-2">Company Name</label>
                    <input type="text" required className="cinematic-input w-full font-bold" value={form.companyName} onChange={update('companyName')} />
                  </div>
                  <div className="space-y-3">
                    <label className="section-label ml-2">Registration ID</label>
                    <input type="text" className="cinematic-input w-full font-bold" value={form.registrationId} onChange={update('registrationId')} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="section-label ml-2">Headquarters Address</label>
                  <input type="text" className="cinematic-input w-full font-bold" value={form.address} onChange={update('address')} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                  <div className="space-y-3">
                    <label className="section-label ml-2">Support Email</label>
                    <input type="email" className="cinematic-input w-full font-bold" value={form.supportEmail} onChange={update('supportEmail')} />
                  </div>
                  <div className="space-y-3">
                    <label className="section-label ml-2">Support Phone</label>
                    <input type="text" className="cinematic-input w-full font-bold" value={form.supportPhone} onChange={update('supportPhone')} />
                  </div>
                </div>

                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm font-bold"
                  >
                    <CheckCircle2 size={18} /> Settings saved successfully.
                  </motion.div>
                )}

                <div className="pt-6 border-t border-white/5 mt-8">
                  <button type="submit" className="btn-glossy px-8 h-14 flex items-center justify-center gap-3">
                    <Save size={18} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="glass-panel p-6 lg:p-10">
              <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Financial Defaults</h2>
              <form className="space-y-6 lg:space-y-8" onSubmit={handleSave}>
                <div className="space-y-3">
                  <label className="section-label ml-2">Default Milk Price (NGN/Liter)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                    <input
                      type="number"
                      min="1"
                      className="cinematic-input w-full !pl-14 font-bold max-w-sm"
                      value={form.defaultMilkPrice}
                      onChange={update('defaultMilkPrice')}
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-500 ml-2 mt-2">This is the default price auto-filled during new collections.</p>
                </div>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm font-bold"
                  >
                    <CheckCircle2 size={18} /> Settings saved successfully.
                  </motion.div>
                )}
                <div className="pt-6 border-t border-white/5">
                  <button type="submit" className="btn-glossy px-8 h-14 flex items-center justify-center gap-3">
                    <Save size={18} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="glass-panel p-6 lg:p-10">
              <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Agent Account</h2>
              <div className="space-y-4">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Logged in as</p>
                  <p className="text-white font-bold">{user?.displayName || user?.email || 'Unknown'}</p>
                  <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
                </div>
                <p className="text-slate-500 text-sm font-medium italic">Account details are managed via Google Sign-In.</p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="glass-panel p-6 lg:p-10">
              <h2 className="text-2xl font-display font-bold text-white mb-8 border-b border-white/5 pb-6">Security & Integrity</h2>
              <div className="space-y-4">
                <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield size={18} className="text-indigo-400" />
                    <p className="text-indigo-400 font-bold text-sm">Authentication</p>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">
                    This system uses Google OAuth + JWT-based session management. All financial transactions are
                    server-side and protected by Firestore Security Rules.
                  </p>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard size={18} className="text-emerald-400" />
                    <p className="text-emerald-400 font-bold text-sm">Payment Security</p>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">
                    Paystack webhooks are verified via HMAC-SHA512 signature. All payout operations require
                    active session authentication and are idempotent.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
