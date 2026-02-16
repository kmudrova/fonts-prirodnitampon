'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import type { Sale, StockMovement } from '@/lib/types';

type TimelineItem =
  | { kind: 'sale'; data: Sale }
  | { kind: 'stock_in'; data: StockMovement };

export default function HistoryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: sales }, { data: movements }] = await Promise.all([
      supabase
        .from('sales')
        .select('*')
        .eq('ambassador_id', user.id)
        .order('sold_at', { ascending: false })
        .limit(100),
      supabase
        .from('stock_movements')
        .select('*')
        .eq('ambassador_id', user.id)
        .eq('type', 'IN')
        .order('occurred_at', { ascending: false })
        .limit(100),
    ]);

    const timeline: TimelineItem[] = [
      ...(sales ?? []).map((s) => ({ kind: 'sale' as const, data: s })),
      ...(movements ?? []).map((m) => ({ kind: 'stock_in' as const, data: m })),
    ].sort((a, b) => {
      const dateA = a.kind === 'sale' ? a.data.sold_at : a.data.occurred_at;
      const dateB = b.kind === 'sale' ? b.data.sold_at : b.data.occurred_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    setItems(timeline);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleVoidSale(saleId: string) {
    if (!confirm('Opravdu chcete stornovat tento prodej?')) return;

    const { error } = await supabase.rpc('void_sale', { p_sale_id: saleId });
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setToast({ message: 'Prodej stornován', type: 'success' });
    loadData();
  }

  async function handleVoidMovement(movementId: string) {
    if (!confirm('Opravdu chcete stornovat toto naskladnění?')) return;

    const { error } = await supabase.rpc('void_stock_movement', {
      p_movement_id: movementId,
    });
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setToast({ message: 'Naskladnění stornováno', type: 'success' });
    loadData();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageShell title="Historie">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Načítání...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Žádné záznamy</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              if (item.kind === 'sale') {
                const s = item.data;
                return (
                  <div
                    key={`sale-${s.id}`}
                    className={`bg-white border rounded-xl p-4 ${
                      s.is_void ? 'border-red-200 opacity-60' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                          PRODEJ
                        </span>
                        {s.is_void && (
                          <span className="inline-block ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                            STORNO
                          </span>
                        )}
                        <p className="text-lg font-bold mt-1">{s.qty} ks</p>
                        <p className="text-xs text-gray-500">{formatDate(s.sold_at)}</p>
                        {s.note && <p className="text-xs text-gray-400 mt-1">{s.note}</p>}
                      </div>
                      {!s.is_void && (
                        <button
                          onClick={() => handleVoidSale(s.id)}
                          className="text-xs text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                        >
                          Storno
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                const m = item.data;
                return (
                  <div
                    key={`mov-${m.id}`}
                    className={`bg-white border rounded-xl p-4 ${
                      m.is_void ? 'border-red-200 opacity-60' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          NASKLADNĚNÍ
                        </span>
                        {m.is_void && (
                          <span className="inline-block ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                            STORNO
                          </span>
                        )}
                        <p className="text-lg font-bold mt-1">+{m.qty} ks</p>
                        <p className="text-xs text-gray-500">{formatDate(m.occurred_at)}</p>
                        {m.note && <p className="text-xs text-gray-400 mt-1">{m.note}</p>}
                      </div>
                      {!m.is_void && (
                        <button
                          onClick={() => handleVoidMovement(m.id)}
                          className="text-xs text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                        >
                          Storno
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </PageShell>
      <BottomNav />
    </>
  );
}
