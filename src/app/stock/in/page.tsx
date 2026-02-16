'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';

export default function StockInPage() {
  const supabase = createClient();
  const router = useRouter();
  const [qty, setQty] = useState(5);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.rpc('record_stock_in', {
      p_qty: qty,
      p_occurred_at: new Date().toISOString(),
      p_note: note || null,
    });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    setToast({ message: `Naskladněno ${qty} ks!`, type: 'success' });
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageShell title="Naskladnit" backHref="/dashboard">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Qty selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Počet kusů
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-14 h-14 rounded-xl bg-gray-200 text-2xl font-bold text-gray-700 hover:bg-gray-300 transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center text-3xl font-bold border border-gray-300 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-14 h-14 rounded-xl bg-gray-200 text-2xl font-bold text-gray-700 hover:bg-gray-300 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poznámka (volitelná)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. číslo objednávky"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ukládám...' : `Naskladnit (${qty} ks)`}
          </button>
        </form>
      </PageShell>
      <BottomNav />
    </>
  );
}
