import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db.ts';
import { MilkRecord } from '../../types.ts';
import { cn, formatCurrency } from '../../lib/utils.ts';
import { CloudSyncService } from '../../services/syncService.ts';
import { 
  Droplet, 
  Trash2, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  ChevronDown,
  PlusCircle,
  Clock,
  Loader2,
  Database,
  FileTerminal,
  Zap,
  ChevronRight
} from 'lucide-react';

export default function MilkCollection() {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('250');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const todayRecords = useLiveQuery(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    return db.milkRecords.where('timestamp').above(startOfDay).reverse().toArray();
  }) || [];

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !liters) return;

    setLoading(true);
    setMessage(null);

    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      if (!supplier) throw new Error('Supplier not found');

      const startOfDay = new Date().setHours(0, 0, 0, 0);
      const totalAmount = parseFloat(liters) * parseFloat(price);
      const record: MilkRecord = {
        id: crypto.randomUUID(),
        supplierId: selectedSupplierId,
        supplierName: supplier.name,
        liters: parseFloat(liters),
        pricePerLiter: parseFloat(price),
        totalAmount,
        amountPaid: 0,
        status: 'PAID',
        timestamp: Date.now(),
        paymentDueDate: Date.now() + (7 * 24 * 60 * 60 * 1000),
        synced: false,
        updatedAt: Date.now()
      };

      await db.transaction('rw', db.suppliers, db.milkRecords, async () => {
        const startOfDayTx = new Date().setHours(0, 0, 0, 0);
        const existingInTx = await db.milkRecords
          .where('supplierId').equals(selectedSupplierId)
          .and(r => r.timestamp > startOfDayTx)
          .first();

        if (existingInTx) {
          throw new Error('A collection record already exists for this supplier today.');
        }

        const txSupplier = await db.suppliers.get(selectedSupplierId);
        if (!txSupplier) throw new Error('Supplier not found during transaction');

        await db.milkRecords.add(record);
        await db.suppliers.update(selectedSupplierId, {
          walletBalance: (txSupplier.walletBalance || 0) + totalAmount,
          updatedAt: Date.now(),
          synced: false
        });
      });

      setLiters('');
      try {
        await CloudSyncService.syncAll();
        setMessage({ type: 'success', text: `Recorded and synced: ${liters}L for ${supplier.name}` });
      } catch {
        setMessage({ type: 'success', text: `Saved locally (sync pending): ${liters}L for ${supplier.name}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const totalVolumeToday = todayRecords.reduce((sum, rec) => sum + rec.liters, 0);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-8 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Milk Collection</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Log and manage daily milk production</p>
        </div>
        <div className="flex items-center gap-4 lg:gap-8 bg-white/[0.02] border border-white/5 p-4 pr-6 rounded-3xl backdrop-blur-3xl">
          <div className="p-4 bg-indigo-600/10 text-indigo-400 rounded-2xl shadow-inner">
            <Droplet size={28} />
          </div>
          <div className="flex flex-col">
            <span className="section-label !mb-0 opacity-40">Total Production Today</span>
            <span className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
              {totalVolumeToday.toFixed(1)} <span className="text-sm font-medium text-slate-500">Liters</span>
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
        <div className="lg:col-span-5">
          <div className="liquid-card p-6 lg:p-10 relative overflow-hidden backdrop-blur-[60px] bg-white/[0.02]">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl">
                <FileTerminal size={22} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Collection Details</h2>
            </div>
            
            <form onSubmit={handleCollect} className="space-y-6 lg:space-y-8">
              <div className="space-y-3">
                <label className="section-label ml-2">Select Supplier</label>
                <div className="relative group">
                  <select 
                    required
                    className="w-full cinematic-input appearance-none cursor-pointer pr-14 text-slate-300 font-semibold"
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="" className="bg-slate-900 italic opacity-50">Select from registered suppliers</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900">{s.name} • {s.location}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-indigo-400 transition-colors" size={20} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3">
                  <label className="section-label ml-2">Milk Volume (L)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1" 
                      required 
                      placeholder="0.00"
                      className="cinematic-input w-full text-lg font-bold"
                      value={liters}
                      onChange={e => setLiters(e.target.value)}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest pointer-events-none">Liters</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="section-label ml-2">Price per Liter</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required 
                      className="cinematic-input w-full text-lg font-bold text-indigo-400 placeholder-indigo-400/20"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest pointer-events-none">NGN</div>
                  </div>
                </div>
              </div>

              <div className="p-5 lg:p-8 bg-white/[0.015] border border-white/5 rounded-[2rem] shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="section-label !mb-0 opacity-40">Total Amount Due</span>
                  <span className="text-2xl md:text-3xl font-display font-extrabold text-indigo-400 tracking-tight drop-shadow-sm">
                    {formatCurrency(parseFloat(liters || '0') * parseFloat(price || '0'))}
                  </span>
                </div>
              </div>
              
              <button 
                disabled={loading}
                type="submit" 
                className="btn-glossy w-full h-18 text-base shadow-2xl shadow-indigo-600/20"
              >
                {loading ? <Loader2 className="animate-spin w-6 h-6 text-white/50" /> : <Zap size={20} />}
                {loading ? 'Processing...' : 'Submit Record'}
              </button>

              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "flex items-center gap-4 p-6 rounded-[1.5rem] border text-sm font-bold shadow-lg",
                      message.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col space-y-6 lg:space-y-8">
          <div className="flex items-center justify-between px-4">
            <h3 className="section-label flex items-center gap-3 !mb-0 text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Today's Collections
            </h3>
          </div>
          
          <div className="glass-panel overflow-hidden border-white/5 flex-1 w-full relative">
            <div className="max-h-[750px] overflow-auto custom-scrollbar overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-white/[0.02] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Supplier / Time</th>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Volume</th>
                    <th className="px-6 py-5 section-label !mb-0 opacity-40 whitespace-nowrap">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {todayRecords.map((record) => (
                      <motion.tr 
                        layout
                        key={record.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        <td className="px-6 py-6">
                          <div className="text-base font-semibold text-white tracking-tight group-hover:text-indigo-400 transition-colors uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{record.supplierName}</div>
                          <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                            <Clock size={10} />
                            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="text-base font-bold text-white tracking-widest whitespace-nowrap">{record.liters.toFixed(1)} <span className="text-[10px] text-slate-600">LITERS</span></div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="text-base font-bold text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.2)] whitespace-nowrap">{formatCurrency(record.totalAmount)}</div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  
                  {todayRecords.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-40 text-center">
                        <div className="flex flex-col items-center gap-6">
                          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-full text-slate-800">
                             <Database size={48} strokeWidth={1} />
                          </div>
                          <p className="text-slate-500 font-medium text-lg italic">
                            No records found for today.<br />Start by logging a new collection.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
