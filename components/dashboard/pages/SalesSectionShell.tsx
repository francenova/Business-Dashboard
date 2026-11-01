'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Receipt, CalendarDays } from 'lucide-react';
import { SalesRegisterPage } from '@/components/dashboard/pages/SalesRegisterPage';
import { DailySalesReportPage } from '@/components/dashboard/pages/DailySalesReportPage';

type SalesMode = 'register' | 'daily-report';

// Thin wrapper that toggles between the Sales Register (TSR) and the Daily
// Sales Report (DSR) under the same nav entry/route — avoids adding a
// second flat sidebar item for every new report variant. Neither child page
// is touched by this wrapper; each stays fully self-contained.
export const SalesSectionShell: React.FC = () => {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'daily-report' ? 'daily-report' : 'register';
  const [mode, setMode] = useState<SalesMode>(initialMode);

  return (
    <div>
      <div className="print:hidden px-4 lg:px-8 pt-4 lg:pt-8 max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
          <button
            id="sales-mode-register"
            onClick={() => setMode('register')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Sales Register
          </button>
          <button
            id="sales-mode-daily-report"
            onClick={() => setMode('daily-report')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'daily-report'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Daily Sales Report
          </button>
        </div>
      </div>

      {mode === 'register' ? <SalesRegisterPage /> : <DailySalesReportPage />}
    </div>
  );
};
