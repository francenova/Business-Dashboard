import { useEffect } from 'react';

/**
 * Global custom hook that enables "Enter-to-Next" form navigation.
 * Pressing Enter in any input or select field automatically moves focus
 * to the next focusable input element in the form/document.
 */
export function useEnterToNext() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();

      // Skip textareas (allow multiline typing) and buttons (allow button click on Enter)
      if (tagName === 'textarea' || tagName === 'button') return;

      // Skip contentEditable elements
      if (target.isContentEditable) return;

      if (tagName === 'input' || tagName === 'select') {
        const inputType = (target as HTMLInputElement).type;
        // Don't intercept submit buttons or checkboxes/radios if they are action triggers
        if (inputType === 'submit' || inputType === 'button' || inputType === 'file') return;

        e.preventDefault();

        // Find closest form or fall back to container/document
        const container = target.closest('form') || target.closest('[role="dialog"]') || document.body;

        const allFocusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
          )
        ).filter(
          (el) =>
            el.offsetWidth > 0 &&
            el.offsetHeight > 0 &&
            window.getComputedStyle(el).visibility !== 'hidden' &&
            window.getComputedStyle(el).display !== 'none'
        );

        const currentIndex = allFocusables.indexOf(target);
        if (currentIndex !== -1 && currentIndex + 1 < allFocusables.length) {
          const nextEl = allFocusables[currentIndex + 1];
          nextEl.focus();
          if (nextEl instanceof HTMLInputElement) {
            nextEl.select?.();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
