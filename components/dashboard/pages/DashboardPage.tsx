'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  Users,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Pill,
  FileText,
  Eye,
  Clock,
  Truck,
  CheckCircle2,
  Plus,
  Search,
  Stethoscope,
  Receipt,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Calendar,
  Loader2,
  Percent,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const router = useRouter();
  const {
    patients,
    activities,
    settings,
    navigateTo,
    setGlobalSearchOpen,
    visits,
    expenses,
  } = useApp();

  const { stats, isLoading } = useDashboardStats();

  // Pending for a single patient, aggregated across all their visits — same
  // Total/Advance/Pending formula used on Patient Database and Patient Visit.
  const getPatientPending = (patientId: string) => {
    const pVisits = visits.filter((v) => v.patientId === patientId);
    const total = pVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
    const advance = pVisits.reduce((acc, v) => acc + (v.payment?.advance || 0), 0);
    return Math.max(0, total - advance);
  };

  const [revenueTimeframe, setRevenueTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-4 text-indigo-600 dark:text-indigo-400">
          <Loader2 className="w-10 h-10 animate-spin" />
          <span className="font-bold tracking-tight">Syncing Live Dashboard...</span>
        </div>
      </div>
    );
  }

  const {
    todayEyeExamsCount,
    todayPatientsCount,
    todayPrescriptionsCount,
    todayRevenue,
    todayExpenses,
    todayProfit,
    todayMedicineSales,
    pendingPaymentsTotal,
    pendingDeliveriesCount,
    readyOrdersCount,
    monthGstCollected,
  } = stats;

  // Helper to format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getPastDays = (days: number) => {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  };

  const past7Days = getPastDays(7);
  const chartDataWeekly = past7Days.map(dateStr => {
    const dayVisits = visits.filter(v => v.date === dateStr);
    const dayExpenses = expenses.filter(e => e.date === dateStr);
    const rev = dayVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
    const exp = dayExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    return {
      name: formatDate(dateStr),
      revenue: rev,
      expenses: exp,
      profit: Math.max(0, rev - exp),
    };
  });

  const getPastWeeks = (weeks: number) => {
    const result = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i * 7 + 6));
      const end = new Date();
      end.setDate(end.getDate() - (i * 7));
      result.push({ start, end, label: `Week ${4 - i}` });
    }
    return result;
  };

  const chartDataMonthly = getPastWeeks(4).map(week => {
    const startStr = week.start.toISOString().split('T')[0];
    const endStr = week.end.toISOString().split('T')[0];
    const weekVisits = visits.filter(v => v.date >= startStr && v.date <= endStr);
    const weekExpenses = expenses.filter(e => e.date >= startStr && e.date <= endStr);
    const rev = weekVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
    const exp = weekExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    return {
      name: week.label,
      revenue: rev,
      expenses: exp,
      profit: Math.max(0, rev - exp),
    };
  });

  const chartDataDaily = [
    { name: 'Today', revenue: todayRevenue, expenses: todayExpenses, profit: todayProfit },
  ];

  return (
    <div id="dashboard-page" className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-semibold text-indigo-300">
              Live Optical Clinic Workflow
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
            Welcome, {settings.doctorName || 'Dr. R. Kumar'}
          </h2>
          <p className="text-sm text-slate-300 max-w-xl">
            {settings.clinicName || 'VisionCare Eye Clinic'} • {settings.address || 'Sector 21, Noida'}. All 10 workflow metrics updated in real time.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            id="quick-start-visit-btn"
            onClick={() => {
              if (patients.length > 0) {
                router.push(`/visit/new?patientId=${patients[0].id}`);
              } else {
                navigateTo('patients');
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs lg:text-sm shadow-md transition-all active:scale-95"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Start Eye Test</span>
          </button>

          <button
            id="quick-add-patient-btn"
            onClick={() => navigateTo('patients')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-semibold text-xs lg:text-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Patient</span>
          </button>
        </div>
      </div>

      {/* 10 CORE METRIC CARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Today&apos;s Clinic Summary
          </h3>
          <span className="text-xs text-slate-500">Live Auto-Sync</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Today's Patients */}
          <div
            onClick={() => navigateTo('patients')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-indigo-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Today&apos;s Patients</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              {todayPatientsCount}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Total Registered: {patients.length}</p>
          </div>

          {/* 2. Today's Revenue */}
          <div
            onClick={() => navigateTo('reports')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Today&apos;s Revenue</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{todayRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Invoices generated today</p>
          </div>

          {/* 3. Today's Expenses */}
          <div
            onClick={() => navigateTo('reports')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-rose-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Today&apos;s Expenses</span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-xl">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              ₹{todayExpenses.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Clinic operational costs</p>
          </div>

          {/* 4. Today's Profit */}
          <div
            onClick={() => navigateTo('reports')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-blue-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Today&apos;s Profit</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-blue-600 dark:text-blue-400">
              ₹{todayProfit.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Net profit after expenses</p>
          </div>

          {/* 5. Today's Medicine Sales */}
          <div
            onClick={() => navigateTo('inventory')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-purple-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Medicine Sales</span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-xl">
                <Pill className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              ₹{todayMedicineSales.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Pharma & eye drops revenue</p>
          </div>

          {/* 6. Today's Prescriptions */}
          <div
            onClick={() => navigateTo('prescription')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-amber-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Prescriptions</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              {todayPrescriptionsCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Generated & printed Rx</p>
          </div>

          {/* 7. Today's Eye Tests */}
          <div
            onClick={() => navigateTo('patient-visit')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-teal-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Eye Examinations</span>
              <div className="p-2 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-xl">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              {todayEyeExamsCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Computerized tests done</p>
          </div>

          {/* 8. Pending Payments */}
          <div
            onClick={() => navigateTo('patients')}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Pending</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{pendingPaymentsTotal.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Outstanding patient dues</p>
          </div>

          {/* 9. Pending Deliveries */}
          <div
            onClick={() => {
              navigateTo('patients');
              router.push('/?deliveryStatus=Pending%20Delivery');
            }}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-indigo-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Pending Deliveries</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
              {pendingDeliveriesCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Lenses under edging/fitting</p>
          </div>

          {/* 10. Ready Orders */}
          <div
            onClick={() => {
              navigateTo('patients');
              router.push('/?deliveryStatus=Ready%20Order');
            }}
            className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Ready Orders</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {readyOrdersCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Ready for patient pickup</p>
          </div>

          {/* 11. GST Collected (This Month) — only shown once GST is enabled */}
          {settings.gstEnabled && (
            <div
              onClick={() => navigateTo('sales-register')}
              className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-purple-500/50 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">GST Collected</span>
                <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-xl">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-black text-purple-600 dark:text-purple-400">
                ₹{(monthGstCollected || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">This month</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS & CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Chart */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Revenue & Profit Analysis
              </h3>
              <p className="text-xs text-slate-500">
                Income vs Expenses breakdown for {settings.clinicName || 'VisionCare Eye Clinic'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/reports')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                View Full Analysis <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                <button
                id="chart-daily-btn"
                onClick={() => setRevenueTimeframe('daily')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  revenueTimeframe === 'daily'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Daily
              </button>
              <button
                id="chart-weekly-btn"
                onClick={() => setRevenueTimeframe('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  revenueTimeframe === 'weekly'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Weekly
              </button>
              <button
                id="chart-monthly-btn"
                onClick={() => setRevenueTimeframe('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  revenueTimeframe === 'monthly'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Monthly
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {revenueTimeframe === 'daily' ? (
                <BarChart data={chartDataDaily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : revenueTimeframe === 'weekly' ? (
                <AreaChart data={chartDataWeekly}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              ) : (
                <BarChart data={chartDataMonthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Quick Actions
            </h3>
            <p className="text-xs text-slate-500">Instant shortcuts for clinic tasks</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="qa-add-patient"
              onClick={() => navigateTo('patients')}
              className="flex flex-col items-start p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 rounded-2xl text-left transition-all group"
            >
              <div className="p-2 bg-indigo-600 text-white rounded-xl mb-2 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Add Patient</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Register new record</span>
            </button>

            <button
              id="qa-search-patient"
              onClick={() => setGlobalSearchOpen(true)}
              className="flex flex-col items-start p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-slate-200 dark:border-slate-700/60 hover:border-blue-300 rounded-2xl text-left transition-all group"
            >
              <div className="p-2 bg-blue-600 text-white rounded-xl mb-2 group-hover:scale-105 transition-transform">
                <Search className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Search Anything</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Global search (⌘K)</span>
            </button>

            <button
              id="qa-start-eye-test"
              onClick={() => {
                if (patients.length > 0) {
                  router.push(`/visit/new?patientId=${patients[0].id}`);
                } else {
                  navigateTo('patients');
                }
              }}
              className="flex flex-col items-start p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700/60 hover:border-emerald-300 rounded-2xl text-left transition-all group"
            >
              <div className="p-2 bg-emerald-600 text-white rounded-xl mb-2 group-hover:scale-105 transition-transform">
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Start Eye Test</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Refraction & Rx</span>
            </button>

            <button
              id="qa-add-medicine"
              onClick={() => navigateTo('inventory')}
              className="flex flex-col items-start p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-slate-200 dark:border-slate-700/60 hover:border-purple-300 rounded-2xl text-left transition-all group"
            >
              <div className="p-2 bg-purple-600 text-white rounded-xl mb-2 group-hover:scale-105 transition-transform">
                <Pill className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Add Medicine</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Update stock & rack</span>
            </button>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY LOGS & RECENT PATIENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Recent Clinic Activity
            </h3>
            <span className="text-xs text-slate-500">Realtime Timeline</span>
          </div>

          <div className="space-y-3">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div
                  className={`p-2 rounded-xl text-white shrink-0 ${
                    act.type === 'visit'
                      ? 'bg-emerald-600'
                      : act.type === 'prescription'
                      ? 'bg-indigo-600'
                      : act.type === 'payment'
                      ? 'bg-blue-600'
                      : 'bg-purple-600'
                  }`}
                >
                  {act.type === 'visit' ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : act.type === 'prescription' ? (
                    <FileText className="w-3.5 h-3.5" />
                  ) : act.type === 'payment' ? (
                    <IndianRupee className="w-3.5 h-3.5" />
                  ) : (
                    <Pill className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {act.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Patients */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Recent Registered Patients
            </h3>
            <button
              onClick={() => navigateTo('patients')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {patients.slice(0, 5).map((p) => (
              <div
                key={p.id}
                onClick={() => router.push(`/patients/${p.id}`)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900/60 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({p.id})</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {p.age} yrs • {p.gender} • Ph: {p.phone}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {getPatientPending(p.id) > 0 ? `Due: ₹${getPatientPending(p.id).toLocaleString('en-IN')}` : 'Paid'}
                  </span>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    Open Profile &rarr;
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
