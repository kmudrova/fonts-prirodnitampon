'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import PageShell from '@/components/PageShell';
import BottomNav from '@/components/BottomNav';
import { QRCodeSVG } from 'qrcode.react';

export default function QRPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, [supabase]);

  const referralUrl = userId
    ? `https://example.com/newsletter?ref=${userId}`
    : '';

  return (
    <>
      <PageShell title="QR kód pro newsletter">
        {userId ? (
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <QRCodeSVG value={referralUrl} size={220} level="M" />
            </div>

            <p className="text-sm text-gray-500 text-center max-w-xs break-all">
              {referralUrl}
            </p>

            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-center text-base transition-colors"
            >
              Otevřít odkaz
            </a>

            <button
              onClick={() => {
                navigator.clipboard.writeText(referralUrl);
                alert('Odkaz zkopírován!');
              }}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-center text-base transition-colors"
            >
              Kopírovat odkaz
            </button>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">Načítání...</div>
        )}
      </PageShell>
      <BottomNav />
    </>
  );
}
