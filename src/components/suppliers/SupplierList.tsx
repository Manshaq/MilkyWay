import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db.ts';
import { Supplier } from '../../types.ts';
import { cn, formatCurrency } from '../../lib/utils.ts';
import { CloudSyncService } from '../../services/syncService.ts';
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Wallet, 
  ExternalLink,
  UserPlus,
  Loader2,
  X,
  Users,
  Database,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import api from '../../lib/api.ts';

function WalletPayoutModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CASH' | 'BANK'>('CASH');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Enter a valid amount');
      setLoading(false);
      return;
    }
    if (numAmount > supplier.walletBalance) {
      setError('Insufficient wallet balance');
      setLoading(false);
      return;
    }

    try {
      const transactionId = crypto.randomUUID();
      if (type === 'CASH') {
        await api.post('/api/wallet/withdraw/cash', { supplierId: supplier.id, amount: numAmount, transactionId });
      } else {
        await api.post('/api/wallet/withdraw/bank', { supplierId: supplier.id, amount: numAmount, transactionId });
      }
      
      // Update local dexie state immediately
      const txSupplier = await db.suppliers.get(supplier.id);
      if (txSupplier) {
        await db.suppliers.update(supplier.id, {
          walletBalance: (txSupplier.walletBalance || 0) - numAmount
        });
      }
      
      setSuccess(`Successfully processed ${formatCurrency(numAmount)} payout`);
      setAmount('');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err && typeof err === 'object' && 'response' in err ? (err as any).response?.data?.error || (err as any).message || 'Payout failed' : (err as Error).message || 'Payout failed');
    } finally {
      setLoading(false);
    }
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

        <div className="mb-10">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 shadow-inner">
            <Wallet size={28} />
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight leading-tight uppercase">Supplier Payout</h2>
          <p className="text-slate-400 mt-2 font-medium">Available Balance: <span className="text-indigo-400 font-bold">{formatCurrency(supplier.walletBalance)}</span></p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-400 text-sm font-bold mb-6 flex items-center gap-3">
            <AlertCircle size={18} /> {error}
          </div>
        )}
        
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-400 text-sm font-bold mb-6 flex items-center gap-3">
            <ShieldCheck size={18} /> {success}
          </div>
        )}

        <form onSubmit={handleWithdraw} className="space-y-6 lg:space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('CASH')}
              className={cn(
                "py-6 px-4 rounded-2xl border font-bold text-sm transition-all flex flex-col items-center gap-3",
                type === 'CASH' 
                  ? "bg-indigo-500/10 border-indigo-500/30 text-white" 
                  : "bg-white/[0.02] border-white/5 text-slate-500 hover:bg-white/5"
              )}
            >
              <div className={cn("p-2 rounded-xl", type === 'CASH' ? "bg-indigo-500 text-white" : "bg-white/5")}><Wallet size={20} /></div>
              Collect Cash
            </button>
            <button
              type="button"
              onClick={() => setType('BANK')}
              className={cn(
                "py-6 px-4 rounded-2xl border font-bold text-sm transition-all flex flex-col items-center gap-3",
                type === 'BANK' 
                  ? "bg-indigo-500/10 border-indigo-500/30 text-white" 
                  : "bg-white/[0.02] border-white/5 text-slate-500 hover:bg-white/5"
              )}
            >
              <div className={cn("p-2 rounded-xl", type === 'BANK' ? "bg-indigo-500 text-white" : "bg-white/5")}><CreditCard size={20} /></div>
              Bank Transfer
            </button>
          </div>

          {type === 'BANK' && (
            <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">Destination Bank</p>
              <p className="text-center font-bold text-white text-lg">{supplier.bankName || 'Not Set'}</p>
              <p className="text-center text-slate-400 font-medium font-mono">{supplier.accountNumber || 'Not Set'}</p>
            </div>
          )}

          <div className="space-y-3">
            <label className="section-label ml-2">Amount to Withdraw</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
              <input
                type="number"
                required
                max={supplier.walletBalance}
                min="100"
                className="w-full cinematic-input h-16 !pl-14 text-xl font-bold"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <button
            disabled={loading || supplier.walletBalance <= 0 || (type === 'BANK' && !supplier.accountNumber)}
            type="submit"
            className="w-full btn-glossy h-16 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <ChevronRight size={20} />}
            <span className="font-bold text-base">{loading ? 'Processing...' : 'Confirm Payout'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
const SupplierCard: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
  const [showPayout, setShowPayout] = useState(false);

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="liquid-card p-6 lg:p-10 flex flex-col justify-between group h-full relative overflow-hidden"
      >
      <div>
        <div className="flex items-start justify-between mb-8">
          <div className="p-4 bg-indigo-600/10 border border-indigo-500/10 text-indigo-400 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            <Users size={24} />
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-colors",
            supplier.synced ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-slate-500 border-white/5"
          )}>
            {supplier.synced ? 'Synced' : 'Cloud Pending'}
          </div>
        </div>
        
        <h3 className="text-2xl font-display font-extrabold text-white tracking-tight leading-tight mb-6 group-hover:text-indigo-400 transition-colors uppercase">{supplier.name}</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/5 rounded-xl"><Phone size={14} className="text-slate-500" /></div>
            <span className="text-sm font-semibold text-slate-400 tracking-tight">{supplier.phone}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/5 rounded-xl"><MapPin size={14} className="text-slate-500" /></div>
            <span className="text-sm font-bold text-slate-400 tracking-tight uppercase">{supplier.location}</span>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="section-label !mb-0 opacity-40">Wallet Balance</span>
            <span className="text-2xl font-display font-bold text-white tracking-tight">{formatCurrency(supplier.walletBalance)}</span>
          </div>
          <button 
            onClick={() => setShowPayout(true)}
            className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all duration-300 text-slate-500 shadow-sm"
          >
            <ExternalLink size={20} />
          </button>
        </div>
      </div>
      
      {/* Dynamic Glow */}
      <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[50px] rounded-full group-hover:bg-indigo-500/10 transition-all duration-700" />
    </motion.div>

    {showPayout && <WalletPayoutModal supplier={supplier} onClose={() => setShowPayout(false)} />}
    </>
  );
}

function AddSupplierModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    location: '',
    bankName: '',
    accountNumber: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = crypto.randomUUID();
      await db.suppliers.add({
        ...form,
        id,
        walletBalance: 0,
        synced: false,
        updatedAt: Date.now(),
        joinDate: Date.now()
      });
      await CloudSyncService.syncAll().catch(err => console.error('Sync failed:', err));
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-2xl p-6 lg:p-14 relative overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 lg:top-8 right-8 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
          <X size={24} />
        </button>
        
        <div className="mb-6 lg:mb-12">
          <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 font-bold shadow-inner">
            <UserPlus size={28} />
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight leading-tight">Register Supplier</h2>
          <p className="text-slate-500 font-medium text-lg mt-2">Add a new dairy partner to the system</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
            <div className="space-y-3">
              <label className="section-label ml-2">Full Name</label>
              <input type="text" required className="cinematic-input w-full" placeholder="John Doe" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="space-y-3">
              <label className="section-label ml-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input type="text" required className="cinematic-input w-full !pl-14" placeholder="+234..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="section-label ml-2">Collection Location</label>
            <div className="relative">
              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              <input type="text" required className="cinematic-input w-full !pl-14" placeholder="Sector / Cluster / Region" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 mt-10">
            <div className="flex items-center gap-3 mb-8">
              <CreditCard size={18} className="text-indigo-400" />
              <h3 className="section-label !mb-0 font-bold text-white uppercase tracking-widest text-xs">Payment Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
              <div className="space-y-3">
                <label className="section-label ml-2 text-slate-500">Bank Name</label>
                <input type="text" required className="cinematic-input w-full" placeholder="Zenith/Access Bank" value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="section-label ml-2 text-slate-500">Account Number</label>
                <input type="text" required className="cinematic-input w-full" placeholder="0001234567" value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} />
              </div>
            </div>
          </div>

          <button 
            disabled={loading} 
            type="submit" 
            className="btn-glossy w-full h-16 mt-8 shadow-2xl shadow-indigo-600/20"
          >
            {loading ? <Loader2 className="animate-spin w-6 h-6 text-white/50" /> : <Plus size={20} />}
            <span className="font-bold text-base">{loading ? 'Processing...' : 'Register Supplier'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function SupplierList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const suppliers = useLiveQuery(() => {
    if (!searchTerm) return db.suppliers.toArray();
    return db.suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.phone.includes(searchTerm)
    ).toArray();
  }, [searchTerm]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-8 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Suppliers</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Manage your dairy supplier network</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-glossy flex items-center justify-center gap-4 px-8"
        >
          <UserPlus size={20} />
          <span className="text-base font-bold">Add New Supplier</span>
        </button>
      </header>

      <div className="mb-8 lg:mb-16">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={24} />
          <input 
            type="text" 
            placeholder="Search suppliers by name, phone or location..."
            className="w-full cinematic-input h-18 !pl-16 pr-8 text-lg font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-10">
        <AnimatePresence mode="popLayout">
          {suppliers?.map((supplier) => (
            <SupplierCard key={supplier.id} supplier={supplier} />
          ))}
        </AnimatePresence>
        
        {suppliers?.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="col-span-full py-40 glass-panel border-dashed border-white/5 bg-white/[0.01] flex flex-col items-center justify-center gap-4 lg:gap-8"
          >
            <div className="p-5 lg:p-8 bg-white/5 rounded-full text-slate-800">
              <Database size={64} strokeWidth={1} />
            </div>
            <div className="text-center">
              <p className="text-slate-500 font-medium text-xl italic">
                No matching suppliers found.<br />Refine your search or add a new partner.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {isModalOpen && <AddSupplierModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
