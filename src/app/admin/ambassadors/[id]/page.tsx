'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import type { Profile, Sale, StockMovement } from '@/lib/types';

type TimelineItem =
  | { kind: 'sale'; data: Sale }
  | { kind: 'stock_in'; data: StockMovement };

export default function AmbassadorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (prof) setProfile(prof);

    const [{ data: sales }, { data: movements }] = await Promise.all([
      supabase
        .from('sales')
        .select('*')
        .eq('ambassador_id', id)
        .order('sold_at', { ascending: false })
        .limit(200),
      supabase
        .from('stock_movements')
        .select('*')
        .eq('ambassador_id', id)
        .eq('type', 'IN')
        .order('occurred_at', { ascending: false })
        .limit(200),
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
  }, [id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function exportCSV() {
    const header = 'Typ,Datum,Kusy,Poznámka,Storno\n';
    const rows = items
      .map((item) => {
        if (item.kind === 'sale') {
          const s = item.data;
          return `Prodej,${s.sold_at},${s.qty},"${s.note ?? ''}",${s.is_void}`;
        } else {
          const m = item.data;
          return `Naskladnění,${m.occurred_at},${m.qty},"${m.note ?? ''}",${m.is_void}`;
        }
      })
      .join('\n');

    const csv = header + rows;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ambassador-${profile?.name ?? id}-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageShell
        title={profile?.name ?? 'Ambasadorka'}
        backHref="/admin/ambassadors"
      >
        {loading ? (
          <div className="text-center py-10 text-gray-400">Načítání...</div>
        ) : (
          <>
            {/* Export button */}
            <button
              onClick={exportCSV}
              className="w-full mb-4 py-3 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl text-base transition-colors"
            >
              Export CSV
            </button>

            {/* Timeline */}
            {items.length === 0 ? (
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
                            {s.note && (
                              <p className="text-xs text-gray-400 mt-1">{s.note}</p>
                            )}
                          </div>
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
                          {m.note && (
                            <p className="text-xs text-gray-400 mt-1">{m.note}</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </>
        )}
      </PageShell>
      <AdminNav />
    </>
  );
}
