'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Medicine } from '@/lib/types';
import { Search, X, PackageSearch } from 'lucide-react';
import { highlightMatch } from './highlightMatch';

interface InventorySearchPickerProps {
  id: string;
  label: string;
  items: Medicine[];
  value: string;
  onSearchChange: (value: string) => void;
  onSelect: (item: Medicine) => void;
  // How to render each result's title line — Frame matches by name alone,
  // Lens/Contact Lens match by "brand + name" combined (same convention
  // Add Stock and purchaseStock() already use for those two categories).
  displayItem?: (item: Medicine) => string;
  placeholder?: string;
  hint?: string;
}

// Shared "search stocked inventory, or type a new one" dropdown — a bigger,
// card-based replacement for the native <input list="..."> datalist
// previously used on Frame/Lens/Contact Lens. Mirrors the Reading Glass
// search dropdown's UX (already built and working) so all four product
// pickers behave the same way.
export const InventorySearchPicker: React.FC<InventorySearchPickerProps> = ({
  id,
  label,
  items,
  value,
  onSearchChange,
  onSelect,
  displayItem = (item) => item.name,
  placeholder = 'Search stocked inventory, or type a new one...',
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
  const filtered = term ? items.filter((m) => displayItem(m).toLowerCase().includes(term)) : items;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, filtered.length]);

  const selectAndClose = (m: Medicine) => {
    onSelect(m);
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
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
        />
      </div>

      {hint && <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{hint}</p>}

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-72 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1 text-[11px] font-bold text-slate-400 uppercase">
            <span>In Stock ({filtered.length})</span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 p-4 text-xs text-slate-400 text-center">
              <PackageSearch className="w-5 h-5 text-slate-300 dark:text-slate-700" />
              {items.length === 0
                ? 'No items in inventory yet — add some via Expense Management → Add Stock, or fill the fields below manually.'
                : 'No matching items — keep typing to enter a new one manually.'}
            </div>
          ) : (
            filtered.map((m, i) => {
              const isHighlighted = i === highlightedIndex;
              return (
                <button
                  type="button"
                  key={m.id}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onClick={() => selectAndClose(m)}
                  className={`w-full p-2.5 rounded-xl cursor-pointer flex items-center justify-between text-left transition-colors ${
                    isHighlighted ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`font-bold truncate ${isHighlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {highlightMatch(displayItem(m), value)}
                    </div>
                    <div className={`truncate ${isHighlighted ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {[m.specification, m.barcode ? `Code: ${m.barcode}` : null].filter(Boolean).join(' • ')}
                      {(m.specification || m.barcode) && ' • '}
                      Stock:{' '}
                      <span
                        className={
                          isHighlighted
                            ? 'font-semibold text-white'
                            : m.availableStock > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-rose-600 dark:text-rose-400 font-semibold'
                        }
                      >
                        {m.availableStock}
                      </span>
                    </div>
                  </div>
                  <div className={`font-bold shrink-0 ml-3 ${isHighlighted ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    ₹{m.sellingPrice.toLocaleString('en-IN')}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
