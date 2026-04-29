import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Download, Calendar as CalendarIcon, Droplet, CreditCard, Users, Filter, FileText } from 'lucide-react';
import { db } from '../../db.ts';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatCurrency } from '../../lib/utils.ts';
import { format } from 'date-fns';

type DatePreset = 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export default function Reports() {
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Compute actual date bounds (memoized to avoid redundant re-queries)
  const { computedStart, computedEnd } = useMemo(() => {
    if (preset === 'TODAY') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = today.getTime();
      return { computedStart: start, computedEnd: start + 86400000 - 1 };
    }
    if (preset === 'LAST_7_DAYS') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        computedStart: today.getTime() - 6 * 86400000,
        computedEnd: today.getTime() + 86400000 - 1,
      };
    }
    if (preset === 'THIS_MONTH') {
      const today = new Date();
      return {
        computedStart: new Date(today.getFullYear(), today.getMonth(), 1).getTime(),
        computedEnd: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
      };
    }
    // CUSTOM: uses the raw startDate and endDate states
    return {
      computedStart: new Date(startDate).getTime(),
      computedEnd: new Date(endDate).getTime() + 86400000 - 1,
    };
  }, [preset, startDate, endDate]);

  // Fetch data
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const records = useLiveQuery(
    () => db.milkRecords.where('timestamp').between(computedStart, computedEnd).toArray(),
    [computedStart, computedEnd]
  ) || [];
  const transactions = useLiveQuery(
    () => db.transactions.where('timestamp').between(computedStart, computedEnd).toArray(),
    [computedStart, computedEnd]
  ) || [];

  // Derived metrics
  const totalMilk = records.reduce((sum, r) => sum + r.liters, 0);
  const totalMilkValue = records.reduce((sum, r) => sum + r.totalAmount, 0);
  
  // Total payouts logic
  const payouts = transactions.filter(t => t.type.includes('WITHDRAWAL') || t.type === 'PAYMENT');
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
  
  const totalBalances = suppliers.reduce((sum, s) => sum + s.walletBalance, 0);

  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('\n') || str.includes('"') || /^[=+\-@]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCSV = () => {
    // Generate CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // 1. Summary
    csvContent += "REPORT SUMMARY\n";
    csvContent += `Generated,${new Date().toLocaleString()}\n`;
    csvContent += `Period Start,${new Date(computedStart).toLocaleDateString()}\n`;
    csvContent += `Period End,${new Date(computedEnd).toLocaleDateString()}\n`;
    csvContent += `Total Milk (L),${totalMilk.toFixed(1)}\n`;
    csvContent += `Total Milk Value,${totalMilkValue}\n`;
    csvContent += `Total Payouts,${totalPayouts}\n`;
    csvContent += `Outstanding Balances,${totalBalances}\n\n`;

    // 2. Milk Records
    csvContent += "MILK COLLECTIONS\n";
    csvContent += "Date,Supplier Name,Volume (L),Price/L,Total Amount\n";
    records.forEach(r => {
      csvContent += `${escapeCSV(new Date(r.timestamp).toLocaleString())},${escapeCSV(r.supplierName)},${escapeCSV(r.liters)},${escapeCSV(r.pricePerLiter)},${escapeCSV(r.totalAmount)}\n`;
    });
    csvContent += "\n";

    // 3. All Transactions
    csvContent += "ALL MONETARY TRANSACTIONS\n";
    csvContent += "Date,Type,Description/Agent,Amount\n";
    transactions.forEach(t => {
      csvContent += `${escapeCSV(new Date(t.timestamp).toLocaleString())},${escapeCSV(t.type)},${escapeCSV(t.supplierName || 'Company')},${escapeCSV(t.amount)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MilkyWay_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 lg:gap-8 mb-8 lg:mb-16 px-2">
        <div>
          <h1 className="text-5xl font-display font-extrabold text-white tracking-tight leading-tight">Reports</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Analytics and financial statements</p>
        </div>
        
        <button 
          onClick={downloadCSV}
          className="btn-glossy flex items-center justify-center gap-4 px-8"
        >
          <Download size={20} />
          <span className="text-base font-bold">Export to CSV</span>
        </button>
      </header>

      {/* Constraints & Filters */}
      <div className="glass-panel p-5 lg:p-8 mb-6 lg:mb-12 flex flex-col lg:flex-row gap-4 lg:gap-8 lg:items-center">
        <div className="flex items-center gap-4 border-r border-white/10 pr-8">
          <Filter size={24} className="text-indigo-400" />
          <span className="font-bold text-slate-300">Time Range:</span>
        </div>
        
        <div className="flex flex-wrap gap-4 flex-1">
          {(['TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'CUSTOM'] as DatePreset[]).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm ${preset === p ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {preset === 'CUSTOM' && (
          <div className="flex items-center gap-4">
            <input 
              type="date" 
              className="cinematic-input !py-3 !px-4"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="text-slate-500 font-bold">TO</span>
            <input 
              type="date" 
              className="cinematic-input !py-3 !px-4"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-8 mb-8 lg:mb-16">
        <div className="liquid-card p-5 lg:p-8 group relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <span className="section-label !mb-0 text-slate-400">Total Milk Collected</span>
            <div className="p-4 bg-white/5 border border-white/10 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl transition-all duration-500">
              <Droplet size={22} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight drop-shadow-sm">{totalMilk.toFixed(1)} <span className="text-lg text-slate-500 font-bold">L</span></div>
          </div>
        </div>

        <div className="liquid-card p-5 lg:p-8 group relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <span className="section-label !mb-0 text-slate-400">Value of Milk</span>
            <div className="p-4 bg-white/5 border border-white/10 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white rounded-2xl transition-all duration-500">
              <FileText size={22} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight drop-shadow-sm">{formatCurrency(totalMilkValue)}</div>
          </div>
        </div>

        <div className="liquid-card p-5 lg:p-8 group relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <span className="section-label !mb-0 text-slate-400">Total Payments Made</span>
            <div className="p-4 bg-white/5 border border-white/10 text-slate-400 group-hover:bg-rose-600 group-hover:text-white rounded-2xl transition-all duration-500">
              <CreditCard size={22} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight drop-shadow-sm">{formatCurrency(totalPayouts)}</div>
          </div>
        </div>

        <div className="liquid-card p-5 lg:p-8 group relative overflow-hidden">
          <div className="flex items-start justify-between mb-8 relative z-10">
            <span className="section-label !mb-0 text-slate-400">Unpaid Balances</span>
            <div className="p-4 bg-white/5 border border-white/10 text-slate-400 group-hover:bg-amber-600 group-hover:text-white rounded-2xl transition-all duration-500">
              <Users size={22} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight drop-shadow-sm">{formatCurrency(totalBalances)}</div>
          </div>
        </div>
      </div>
      
      <div className="glass-panel overflow-hidden border-white/5 p-6 lg:p-10">
        <div className="mb-6 pb-6 border-b border-white/5">
          <h2 className="text-2xl font-bold text-white tracking-tight">Period Breakdown</h2>
          <p className="text-slate-400 font-medium mt-1">Details for {preset.replace(/_/g, ' ')}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          <div>
            <span className="section-label text-indigo-400">Recent Collections in Period</span>
            <div className="space-y-4 max-h-[400px] overflow-auto custom-scrollbar pr-4">
              {records.slice(0, 100).map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white uppercase">{r.supplierName}</h4>
                    <p className="text-xs font-semibold text-slate-500 mt-1">{format(r.timestamp, 'PPp')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-indigo-400">{r.liters} L</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">{formatCurrency(r.totalAmount)}</p>
                  </div>
                </div>
              ))}
              {records.length === 0 && <p className="text-slate-500 font-medium italic">No records found for this period.</p>}
            </div>
          </div>
          
          <div>
            <span className="section-label text-rose-400">All Transactions in Period</span>
            <div className="space-y-4 max-h-[400px] overflow-auto custom-scrollbar pr-4">
              {transactions.slice(0, 100).map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white uppercase">{t.type} <span className="text-slate-500 text-[10px] ml-2">{t.supplierName ? `${t.supplierName}` : 'Company HQ'}</span></h4>
                    <p className="text-xs font-semibold text-slate-500 mt-1">{format(t.timestamp, 'PPp')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-extrabold ${t.type.includes('DEPOSIT') || t.type.includes('CREDIT') ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type.includes('DEPOSIT') || t.type.includes('CREDIT') ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-slate-500 font-medium italic">No transactions found for this period.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
