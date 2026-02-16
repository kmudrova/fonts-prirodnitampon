# Ambasadorky - Přírodní Tampón

MVP web aplikace (mobile-first) pro program ambasadorek. Eviduje prodeje, sklad a provize.

## Tech Stack

- **Next.js 14+** (App Router) + TypeScript
- **Supabase** (Auth + Postgres + RLS + RPC)
- **Tailwind CSS** (vlastní komponenty)
- **Recharts** (graf prodejů)
- **Deploy**: Vercel

## Struktura projektu

```
├── supabase/
│   └── migrations/
│       └── 001_init.sql          # DB schema, views, RPC, RLS
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Redirect -> /dashboard
│   │   ├── login/page.tsx        # Přihlášení
│   │   ├── dashboard/page.tsx    # Dashboard ambasadorky
│   │   ├── sale/new/page.tsx     # Nový prodej
│   │   ├── stock/in/page.tsx     # Naskladnění
│   │   ├── history/page.tsx      # Historie + storno
│   │   ├── qr/page.tsx           # QR kód pro newsletter
│   │   └── admin/
│   │       └── ambassadors/
│   │           ├── page.tsx      # Seznam ambasadorek
│   │           └── [id]/page.tsx # Detail ambasadorky + CSV export
│   ├── components/
│   │   ├── AdminNav.tsx
│   │   ├── BottomNav.tsx
│   │   ├── LogoutButton.tsx
│   │   ├── PageShell.tsx
│   │   ├── StatCard.tsx
│   │   └── Toast.tsx
│   ├── lib/
│   │   ├── supabase-browser.ts   # Supabase klient (browser)
│   │   ├── supabase-server.ts    # Supabase klient (server)
│   │   └── types.ts              # TypeScript typy
│   └── middleware.ts             # Auth guard + role guard
├── .env.local.example
├── package.json
└── README.md
```

## Spuštění

### 1. Supabase projekt

1. Vytvoř nový projekt na [supabase.com](https://supabase.com)
2. Jdi do **SQL Editor** a spusť celý obsah souboru `supabase/migrations/001_init.sql`
3. Zkopíruj si **Project URL** a **anon public key** z Settings > API

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Vyplň hodnoty:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Vytvoření uživatelů

V Supabase Dashboard > Authentication > Users vytvoř uživatele:

**Admin:**
- Email: `admin@example.com`
- Password: libovolné
- User metadata: `{"name": "Admin", "role": "admin"}`

**Ambasadorka (příklad):**
- Email: `jana@example.com`
- Password: libovolné
- User metadata: `{"name": "Jana Nováková"}`

Trigger `on_auth_user_created` automaticky vytvoří profil v tabulce `profiles`.

Pokud potřebuješ ručně nastavit roli admina:
```sql
UPDATE public.profiles SET role = 'admin' WHERE name = 'Admin';
```

### 4. Spuštění dev serveru

```bash
npm install
npm run dev
```

Otevři [http://localhost:3000](http://localhost:3000).

### 5. Deploy na Vercel

1. Push kód do Git repozitáře
2. Importuj projekt na [vercel.com](https://vercel.com)
3. Nastav environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy

## Byznys pravidla

| Parametr | Hodnota |
|---|---|
| Provize za kus | 150 Kč (fix) |
| Maloobchodní cena | 719 Kč (info) |
| Velkoobchodní cena | 569 Kč (info) |
| Low stock warning | <= 2 ks |
| Produkt | 1 (sada) |
| Pilot | 10 ambasadorek |

## Funkce

### Ambasadorka
- Dashboard: sklad, prodeje (měsíc/celkem), provize, graf 30 dní
- Rychlý prodej (1 tap, default 1 ks)
- Naskladnění (default 5 ks)
- Historie s možností storna
- QR kód pro newsletter referral

### Admin
- Seznam ambasadorek s přehledem
- Detail ambasadorky s timeline
- CSV export dat

### Bezpečnost
- Row Level Security (RLS) na všech tabulkách
- RPC funkce se SECURITY DEFINER
- Middleware auth guard + role guard pro /admin/*
- Atomický prodej (kontrola skladu + zápis v jedné transakci)
- Nelze prodat do mínusu skladu
- Storno místo mazání (is_void flag)
