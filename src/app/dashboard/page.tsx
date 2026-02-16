'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import BottomNav from '@/components/BottomNav';
import PageShell from '@/components/PageShell';
import StatCard from '@/components/StatCard';
import type { DashboardData, Profile } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Fetch profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) setProfile(prof);

    // If admin, redirect to admin dashboard
    if (prof?.role === 'admin') {
      router.push('/admin/ambassadors');
      return;
    }

    // Fetch settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    // Fetch stock
    const { data: stockData } = await supabase
      .from('v_stock_on_hand')
      .select('stock')
      .eq('ambassador_id', user.id)
      .single();

    const stock = stockData?.stock ?? 0;

    // Fetch sales for totals
    const { data: allSales } = await supabase
      .from('sales')
      .select('qty, sold_at')
      .eq('ambassador_id', user.id)
      .eq('is_void', false);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const soldTotal = allSales?.reduce((sum, s) => sum + s.qty, 0) ?? 0;
    const soldThisMonth =
      allSales
        ?.filter((s) => s.sold_at >= monthStart)
        .reduce((sum, s) => sum + s.qty, 0) ?? 0;

    const commissionPerUnit = settings?.commission_per_unit ?? 150;

    // Daily sales for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - 29 + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }

    allSales
      ?.filter((s) => new Date(s.sold_at) >= thirtyDaysAgo)
      .forEach((s) => {
        const day = s.sold_at.slice(0, 10);
        if (dailyMap[day] !== undefined) {
          dailyMap[day] += s.qty;
        }
      });

    const dailySales = Object.entries(dailyMap).map(([date, qty]) => ({
      date: date.slice(5), // MM-DD
      qty,
    }));

    setData({
      stock,
      soldThisMonth,
      soldTotal,
      commissionMonth: soldThisMonth * commissionPerUnit,
      commissionTotal: soldTotal * commissionPerUnit,
      lowStockThreshold: settings?.low_stock_threshold ?? 2,
      retailPrice: settings?.retail_price ?? 719,
      wholesalePrice: settings?.wholesale_price ?? 569,
      commissionPerUnit,
      dailySales,
    });

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !data) {
    return (
      <>
        <PageShell title="Dashboard">
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Načítání...</div>
          </div>
        </PageShell>
        <BottomNav />
      </>
    );
  }

  const lowStock = data.stock <= data.lowStockThreshold;

  return (
    <>
      <PageShell title={`Ahoj, ${profile?.name ?? 'Ambasadorko'}!`}>
        {/* Low stock warning */}
        {lowStock && (
          <div className="bg-amber-50 border border-amber-400 rounded-lg p-3 mb-4 text-sm text-amber-800">
            Nízký sklad! Máš jen <strong>{data.stock}</strong> ks. Objednej další.
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/sale/new"
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
          >
            + Prodej
          </Link>
          <Link
            href="/stock/in"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
          >
            + Naskladnit
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Sklad"
            value={`${data.stock} ks`}
            warning={lowStock}
          />
          <StatCard label="Prodáno (měsíc)" value={`${data.soldThisMonth} ks`} />
          <StatCard label="Prodáno (celkem)" value={`${data.soldTotal} ks`} />
          <StatCard
            label="Provize (měsíc)"
            value={`${data.commissionMonth} Kč`}
          />
          <StatCard
            label="Provize (celkem)"
            value={`${data.commissionTotal} Kč`}
          />
          <StatCard
            label="Provize/ks"
            value={`${data.commissionPerUnit} Kč`}
          />
        </div>

        {/* Info prices */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Maloobchodní cena</p>
            <p className="text-lg font-semibold">{data.retailPrice} Kč</p>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Velkoobchodní cena</p>
            <p className="text-lg font-semibold">{data.wholesalePrice} Kč</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Prodeje za posledních 30 dní
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PageShell>
      <BottomNav />
    </>
  );
}
