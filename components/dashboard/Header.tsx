'use client';

import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { Search, Plus, Moon, Sun, ShieldCheck, Eye, Sparkles, ArrowLeft, Settings as SettingsIcon, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    settings,
    updateSettings,
    setGlobalSearchOpen,
    navigateTo,
    activeVisitDraft,
    canGoBack,
    goBack,
    previousPageTitle,
  } = useApp();

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setGlobalSearchOpen]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-30 h-16 bg-white/75 dark:bg-slate-900/70 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-8 flex items-center justify-between gap-4 transition-colors"
    >
      {/* Left: Back Button & Brand / Location */}
      <div className="flex items-center gap-3">
        {canGoBack && (
          <button
            id="header-back-button"
            onClick={goBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 group"
            title={`Return to ${previousPageTitle || 'previous section'}`}
          >
            <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
            {previousPageTitle && (
              <span className="hidden sm:inline-block text-slate-400 dark:text-slate-500 font-normal truncate max-w-[110px]">
                • {previousPageTitle}
              </span>
            )}
          </button>
        )}

        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={settings.clinicName}
            className="w-9 h-9 object-contain rounded-xl bg-white p-0.5 border border-slate-200 dark:border-slate-800 shadow-2xs shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Eye className="w-5 h-5" />
          </div>
        )}
        <div className="hidden xs:block">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {settings.clinicName || 'VisionCare Eye Clinic'}
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              Clinic & Optical
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px] sm:max-w-xs">
            {settings.address || 'Eye Clinic'} • Computerized Testing
          </p>
        </div>
      </div>

      {/* Center: Global Search trigger */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          id="global-search-trigger"
          onClick={() => setGlobalSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 text-sm font-normal transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            <span>Search patients, medicines, invoices, frames...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Search Button */}
        <button
          id="mobile-search-btn"
          onClick={() => setGlobalSearchOpen(true)}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Auto Save Status Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-lg text-xs font-medium border border-emerald-200/60 dark:border-emerald-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{activeVisitDraft ? 'Draft Auto-Saving' : 'Data Auto-Synced'}</span>
        </div>

        {/* Quick Add Patient */}
        <button
          id="header-quick-add-patient"
          onClick={() => navigateTo('patients')}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Patient</span>
        </button>

        {/* Theme Toggle */}
        <button
          id="header-theme-toggle"
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          title={`Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle dark mode"
        >
          {settings.theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Header Settings Shortcut */}
        <button
          id="header-settings-button"
          onClick={() => navigateTo('settings')}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          title="Open Clinic Settings"
          aria-label="Open Clinic Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* Doctor Avatar Badge */}
        <button
          id="header-doctor-badge"
          onClick={() => navigateTo('settings')}
          className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-90 transition-opacity text-left cursor-pointer"
          title="Manage Doctor & Clinic Profile"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-xs shrink-0">
            {settings.doctorName ? settings.doctorName.replace(/Dr\.\s*/i, '').slice(0, 2).toUpperCase() || 'DR' : 'DR'}
          </div>
          <div className="text-left hidden xl:block min-w-0">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[120px]">
              {settings.doctorName || 'Dr. R. Kumar'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none truncate max-w-[120px]">
              {settings.credentials || 'Optometrist'}
            </p>
          </div>
        </button>

        {/* Sign Out */}
        <button
          id="header-sign-out"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
};
