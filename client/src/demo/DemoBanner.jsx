/** A standing notice that this build has no server behind it. */
import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { demoCapturedAt } from './api';

export function DemoBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const captured = new Date(demoCapturedAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div
      className="relative z-40 flex items-start gap-2.5 px-4 py-2.5 text-[0.78rem] sm:px-6 print:hidden"
      style={{ background: 'var(--surface-inverse)', color: 'var(--text-inverse)' }}
      role="status"
    >
      <Info size={15} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 leading-relaxed">
        <strong>Demonstration build.</strong> Every screen shows real responses recorded from the
        application on {captured}, but there is no server behind this page — changes you make are
        kept in your browser for this visit only. Sign in with any account listed on the sign-in
        screen; the password is <code className="font-semibold">maktab2027</code>.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss this notice"
        className="mt-0.5 shrink-0 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}
