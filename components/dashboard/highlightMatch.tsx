import React from 'react';

// Bolds the portion of `text` that matches `term` (case-insensitive, first
// occurrence only) — shared by InventorySearchPicker and TextAutosuggest so
// every suggestion dropdown in the app highlights matches the same way.
export function highlightMatch(text: string, term: string): React.ReactNode {
  const t = term.trim();
  if (!t) return text;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-extrabold">{text.slice(idx, idx + t.length)}</strong>
      {text.slice(idx + t.length)}
    </>
  );
}
