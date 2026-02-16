'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/AdminNav';
import type { AmbassadorSummary } from '@/lib/types';

export default function AdminAmbassadorsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ambassadors, setAmbassadors] = useState<AmbassadorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // Fetch all ambassador profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'ambassador')
      .order('name');

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch settings
    const { data: settings } = await supabase
      .from('settings')
      .select('commission_per_unit')
      .eq('id', 1)
      .single();

    const commissionPerUnit = settings?.commission_per_unit ?? 150;

    // Fetch stock for all ambassadors
    const { data: stockData } = await supabase.from('v_stock_on_hand').select('*');

    // Fetch all non-void sales
    const { data: allSales } = await supabase
      .from('sales')
      .select('ambassador_id, qty, sold_at')
      .eq('is_void', false);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const summaries: AmbassadorSummary[] = profiles.map((p) => {
      const stock = stockData?.find((s) => s.ambassador_id === p.id)?.stock ?? 0;
      const mySales = allSales?.filter((s) => s.ambassador_id === p.id) ?? [];
      const soldTotal = mySales.reduce((sum, s) => sum + s.qty, 0);
      const soldThisMonth = mySales
        .filter((s) => s.sold_at >= monthStart)
        .reduce((sum, s) => sum + s.qty, 0);

      const lastSale = mySales.length > 0
        ? mySales.sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())[0]
            .sold_at
        : null;

      return {
        id: p.id,
        name: p.name,
        stock,
        sold_this_month: soldThisMonth,
        sold_total: soldTotal,
        commission_month: soldThisMonth * commissionPerUnit,
        commission_total: soldTotal * commissionPerUnit,
        last_sale_date: lastSale,
      };
    });

    setAmbassadors(summaries);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '–';
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
    });
  }

  return (
    <>
      <PageShell title="Ambasadorky (Admin)">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Načítání...</div>
        ) : ambassadors.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Žádné ambasadorky</div>
        ) : (
          <div className="space-y-3">
            {ambassadors.map((a) => (
              <button
                key={a.id}
                onClick={() => router.push(`/admin/ambassadors/${a.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{a.name}</h3>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      a.stock <= 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    Sklad: {a.stock} ks
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    <span className="block text-gray-400">Měsíc</span>
                    <span className="font-semibold text-gray-700">
                      {a.sold_this_month} ks / {a.commission_month} Kč
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-400">Celkem</span>
                    <span className="font-semibold text-gray-700">
                      {a.sold_total} ks / {a.commission_total} Kč
                    </span>
                  </div>
                  <div>
                    <span className="block text-gray-400">Posl. prodej</span>
                    <span className="font-semibold text-gray-700">
                      {formatDate(a.last_sale_date)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PageShell>
      <AdminNav />
    </>
  );
}
