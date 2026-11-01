'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl"
        >
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                variant === 'danger'
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              id="confirm-modal-cancel"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              id="confirm-modal-submit"
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-xs transition-all ${
                variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
