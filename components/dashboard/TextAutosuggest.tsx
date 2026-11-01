'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { highlightMatch } from './highlightMatch';

interface TextAutosuggestProps {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}

// Same suggestion-dropdown UX as InventorySearchPicker, but over a plain
// string list (e.g. distinct brand names already in stock) instead of
// Medicine records — used for Brand fields that drive InventorySearchPicker
// cascading. Free-typing is always allowed; picking a suggestion is a
// shortcut, not a requirement.
export const TextAutosuggest: React.FC<TextAutosuggestProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Start typing...',
  hint,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const term = value.trim().toLowerCase();
  const uniqueOptions = Array.from(new Set(options.filter(Boolean)));
  const filtered = term ? uniqueOptions.filter((o) => o.toLowerCase().includes(term)) : uniqueOptions;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, filtered.length]);

  const selectAndClose = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const match = filtered[highlightedIndex];
      if (match) selectAndClose(match);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
        <input
          id={id}
          type="text"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
        />
      </div>

      {hint && <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{hint}</p>}

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-60 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1 text-[11px] font-bold text-slate-400 uppercase">
            <span>Suggestions ({filtered.length})</span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {filtered.map((option, i) => {
            const isHighlighted = i === highlightedIndex;
            return (
              <button
                type="button"
                key={option}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectAndClose(option)}
                className={`w-full p-2.5 rounded-xl cursor-pointer text-left font-bold truncate transition-colors ${
                  isHighlighted ? 'bg-indigo-600 text-white' : 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {highlightMatch(option, value)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
