import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePaystackPayment } from 'react-paystack';
import { db } from '../../db.ts';
import { db as firestore } from '../../lib/firebase.ts';
import { OperationType, handleFirestoreError } from '../../lib/firestore-helpers.ts';
import { doc, onSnapshot } from 'firebase/firestore';
import { cn, formatCurrency } from '../../lib/utils.ts';
import { CloudSyncService } from '../../services/syncService.ts';
import api from '../../lib/api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import { 
  TrendingUp, 
  Droplet, 
  Wallet, 
  RefreshCcw, 
  ChevronRight, 
  Sparkles,
  AlertCircle,
  Users,
  Milk,
  Activity,
  Zap,
  Database,
  BrainCircuit,
  Plus,
  X,
  CreditCard,
  Loader2
} from 'lucide-react';

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="liquid-card p-5 lg:p-8 group relative overflow-hidden">
      <div className="flex items-start justify-between mb-8 relative z-10">
        <span className="section-label !mb-0">{label}</span>
        <div className="p-4 bg-white/5 border border-white/10 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl transition-all duration-500 group-hover:shadow-[0_0_25px_rgba(79,70,229,0.3)]">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <div className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight mb-2 drop-shadow-sm">{value}</div>
        {trend && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{trend}</span>
          </div>
        )}
      </div>
      <div className="absolute top-[-50%] right-[-10%] w-[60%] h-[100%] bg-white/[0.02] blur-[40px] rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-700" />
    </div>
  );
}

function FundCompanyModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const { customUser } = useAuthStore();
  
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const [reference, setReference] = useState(() => `FUND-${Date.now()}`);

  const config = {
    reference,
    email: customUser?.email || "admin@milkyway.com",
    amount: parseFloat(amount) * 100, // Paystack requires kobo/cents
    publicKey: publicKey || 'pk_test_placeholder', 
  };
  
  const initializePayment = usePaystackPayment(config);

  const handlePaystackSuccessAction = async (ref: any) => {
    try {
      await api.post('/api/payments/verify-paystack', { reference: ref.reference });
      setReference(`FUND-${Date.now()}`); // Fresh reference for any future payment
      onSuccess();
      onClose();
    } catch (e) {
      setReference(`FUND-${Date.now()}`); // Fresh reference so retries work
      console.error(e);
      alert(e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.error || `Payment failed to verify on server. Provide support reference: ${ref.reference}` : `Payment failed to verify on server. Provide support reference: ${ref.reference}`);
    }
  };

  const onFundClick = () => {
    if (!publicKey || publicKey === 'pk_test_placeholder') {
      alert('Please set your VITE_PAYSTACK_PUBLIC_KEY in the Settings > Secrets or .env to make live payments.');
      return;
    }
    initializePayment({
      onSuccess: handlePaystackSuccessAction,
      onClose: () => { console.log('closed') }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full max-w-lg p-6 lg:p-10 relative overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
          <X size={24} />
        </button>

        <div className="mb-6 md:mb-10">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 shadow-inner">
            <CreditCard size={28} />
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight leading-tight uppercase">Add Funds</h2>
          <p className="text-slate-400 mt-2 font-medium">Add capital to the company balance via Paystack</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="section-label ml-2">Amount to Fund</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
              <input
                type="number"
                required
                min="1000"
                className="w-full cinematic-input h-16 !pl-14 text-xl font-bold"
                placeholder="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          
          <button
            disabled={!parseFloat(amount) || parseFloat(amount) <= 0}
            onClick={onFundClick}
            className="w-full btn-glossy h-16 flex items-center justify-center gap-3 bg-gradient-to-r hover:from-emerald-600 hover:to-indigo-600 shadow-indigo-500/20 shadow-2xl transition-all duration-500"
          >
            <Zap size={20} />
            <span className="font-bold text-base">Pay with Paystack</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);

  const suppliersCount = useLiveQuery(() => db.suppliers.count()) || 0;
  const recentRecords = useLiveQuery(() => db.milkRecords.orderBy('timestamp').reverse().limit(5).toArray()) || [];
  const unsyncedCount = useLiveQuery(() => db.suppliers.filter(s => !s.synced).count()) || 0;

  const [companyBalance, setCompanyBalance] = useState(0);
  const [showFundModal, setShowFundModal] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(firestore, 'system', 'companyBalance'), (docSnap) => {
      if (docSnap.exists()) {
        setCompanyBalance(docSnap.data().balance || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system/companyBalance');
    });
    return () => unsub();
  }, []);

  const thisMonthBounds = useMemo(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
    };
  }, []);

  const totalMonthlyMilk = useLiveQuery(
    () =>
      db.milkRecords
        .where('timestamp')
        .between(thisMonthBounds.start, thisMonthBounds.end)
        .toArray()
        .then(rs => rs.reduce((acc, r) => acc + r.liters, 0)),
    [thisMonthBounds]
  ) ?? 0;

  const handleSync = async () => {
    setSyncing(true);
    await CloudSyncService.syncAll();
    setSyncing(false);
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Welcome back. Here's your production summary.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowFundModal(true)}
            className="btn-glossy bg-gradient-to-tr from-emerald-600 to-emerald-400 border-none shadow-emerald-500/20 text-white flex items-center gap-3 px-6"
          >
            <Plus size={18} />
            <span className="text-sm font-bold tracking-tight">Add Funds</span>
          </button>
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="btn-outline-glass flex items-center gap-3"
          >
            <RefreshCcw size={18} className={cn(syncing && "animate-spin text-indigo-400")} />
            <span className="text-sm font-semibold">
              {syncing ? 'Synchronizing...' : unsyncedCount > 0 ? `${unsyncedCount} Updates Pending` : 'Cloud Active'}
            </span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-8 mb-8 lg:mb-16">
        <StatCard label="Monthly Production" value={`${totalMonthlyMilk.toFixed(1)} Liters`} icon={<Droplet size={22} />} trend="+12.5% vs last month" />
        <StatCard label="Total Suppliers" value={suppliersCount.toString()} icon={<Users size={22} />} trend="Active" />
        <StatCard label="Company Balance" value={formatCurrency(companyBalance)} icon={<Wallet size={22} />} trend="Live Checked" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-12">
        <div className="space-y-6 lg:space-y-8">
          <div className="flex items-center justify-between px-4">
            <span className="section-label !mb-0 text-slate-300">Recent Collections</span>
            <button className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-2 group">
              Full Statement <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="glass-panel overflow-hidden w-full">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Date</th>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Supplier</th>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Amount</th>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-6 py-6">
                        <div className="text-sm text-slate-400 font-medium whitespace-nowrap">{new Date(rec.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-base font-semibold text-white tracking-tight leading-tight min-w-[120px] line-clamp-1">{rec.supplierName}</div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-base font-bold text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.2)] whitespace-nowrap">{rec.liters} L</div>
                      </td>
                      <td className="px-6 py-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border whitespace-nowrap",
                          rec.status === 'PAID' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                        )}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentRecords.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                           No recent collections found.
                        </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {showFundModal && (
        <FundCompanyModal 
          onClose={() => setShowFundModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

