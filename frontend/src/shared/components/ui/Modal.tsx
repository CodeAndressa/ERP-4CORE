import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative w-full ${sizes[size]} rounded-[30px] border border-violet-100 bg-white`}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: 'spring', duration: 0.3 }}
          >
            {(title || description) && (
              <div className="flex items-start justify-between border-b border-violet-100 px-6 py-5">
                <div>
                  {title && <h2 className="text-base font-semibold text-slate-950">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
                </div>
                <button onClick={onClose} className="ml-4 rounded-full p-2 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
            {footer && (
              <div className="flex justify-end gap-3 border-t border-violet-100 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
