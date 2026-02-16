-- ============================================================
-- Ambassador App – Supabase Migration
-- ============================================================

-- 1. Custom ENUM types
-- ============================================================
CREATE TYPE public.user_role AS ENUM ('admin', 'ambassador');
CREATE TYPE public.movement_type AS ENUM ('IN', 'SALE', 'ADJUSTMENT');

-- 2. Tables
-- ============================================================

-- profiles (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'ambassador',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- settings (single-row config)
CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_per_unit int NOT NULL DEFAULT 150,
  retail_price int NOT NULL DEFAULT 719,
  wholesale_price int NOT NULL DEFAULT 569,
  low_stock_threshold int NOT NULL DEFAULT 2
);

INSERT INTO public.settings (id) VALUES (1);

-- sales
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.profiles(id),
  sold_at timestamptz NOT NULL DEFAULT now(),
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  payment_method text NOT NULL DEFAULT 'cash',
  note text,
  is_void boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_ambassador ON public.sales(ambassador_id);
CREATE INDEX idx_sales_sold_at ON public.sales(sold_at);

-- stock_movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.profiles(id),
  type public.movement_type NOT NULL,
  qty int NOT NULL CHECK (qty > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text,
  sale_id uuid REFERENCES public.sales(id),
  is_void boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_ambassador ON public.stock_movements(ambassador_id);

-- 3. Views
-- ============================================================

-- Stock on hand per ambassador
CREATE OR REPLACE VIEW public.v_stock_on_hand AS
SELECT
  ambassador_id,
  COALESCE(
    SUM(CASE WHEN type = 'IN' AND is_void = false THEN qty ELSE 0 END) -
    SUM(CASE WHEN type = 'SALE' AND is_void = false THEN qty ELSE 0 END),
    0
  ) AS stock
FROM public.stock_movements
GROUP BY ambassador_id;

-- Commission totals per ambassador
CREATE OR REPLACE VIEW public.v_commission_totals AS
SELECT
  s.ambassador_id,
  COALESCE(SUM(s.qty), 0) AS units_sold_total,
  COALESCE(SUM(s.qty), 0) * (SELECT commission_per_unit FROM public.settings WHERE id = 1)
    AS commission_total
FROM public.sales s
WHERE s.is_void = false
GROUP BY s.ambassador_id;

-- 4. RPC Functions (SECURITY DEFINER)
-- ============================================================

-- record_sale: atomically record a sale + stock movement
CREATE OR REPLACE FUNCTION public.record_sale(
  p_qty int DEFAULT 1,
  p_sold_at timestamptz DEFAULT now(),
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_stock int;
  v_sale_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate current stock
  SELECT COALESCE(stock, 0) INTO v_stock
  FROM public.v_stock_on_hand
  WHERE ambassador_id = v_uid;

  IF v_stock IS NULL THEN
    v_stock := 0;
  END IF;

  IF v_stock < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock (have %, need %)', v_stock, p_qty;
  END IF;

  -- Insert sale
  INSERT INTO public.sales (ambassador_id, qty, sold_at, note)
  VALUES (v_uid, p_qty, p_sold_at, p_note)
  RETURNING id INTO v_sale_id;

  -- Insert stock movement (SALE)
  INSERT INTO public.stock_movements (ambassador_id, type, qty, occurred_at, sale_id)
  VALUES (v_uid, 'SALE', p_qty, p_sold_at, v_sale_id);

  RETURN v_sale_id;
END;
$$;

-- record_stock_in: record incoming stock
CREATE OR REPLACE FUNCTION public.record_stock_in(
  p_qty int,
  p_occurred_at timestamptz DEFAULT now(),
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_movement_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.stock_movements (ambassador_id, type, qty, occurred_at, note)
  VALUES (v_uid, 'IN', p_qty, p_occurred_at, p_note)
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- void_sale: mark a sale and its movement as void
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_ambassador_id uuid;
  v_role public.user_role;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check ownership or admin
  SELECT ambassador_id INTO v_ambassador_id
  FROM public.sales WHERE id = p_sale_id;

  IF v_ambassador_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_ambassador_id != v_uid AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.sales SET is_void = true WHERE id = p_sale_id;
  UPDATE public.stock_movements SET is_void = true WHERE sale_id = p_sale_id;
END;
$$;

-- void_stock_movement: mark a stock-in movement as void
CREATE OR REPLACE FUNCTION public.void_stock_movement(p_movement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_ambassador_id uuid;
  v_role public.user_role;
  v_type public.movement_type;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ambassador_id, type INTO v_ambassador_id, v_type
  FROM public.stock_movements WHERE id = p_movement_id;

  IF v_ambassador_id IS NULL THEN
    RAISE EXCEPTION 'Movement not found';
  END IF;

  IF v_type != 'IN' THEN
    RAISE EXCEPTION 'Only IN movements can be voided directly (use void_sale for sales)';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_ambassador_id != v_uid AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.stock_movements SET is_void = true WHERE id = p_movement_id;
END;
$$;

-- 5. RLS Policies
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admin can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- sales policies
CREATE POLICY "Ambassador can read own sales"
  ON public.sales FOR SELECT
  USING (ambassador_id = auth.uid());

CREATE POLICY "Admin can read all sales"
  ON public.sales FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Ambassador can insert own sales"
  ON public.sales FOR INSERT
  WITH CHECK (ambassador_id = auth.uid());

CREATE POLICY "Admin can insert any sales"
  ON public.sales FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Ambassador can update own sales"
  ON public.sales FOR UPDATE
  USING (ambassador_id = auth.uid());

CREATE POLICY "Admin can update all sales"
  ON public.sales FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- stock_movements policies
CREATE POLICY "Ambassador can read own movements"
  ON public.stock_movements FOR SELECT
  USING (ambassador_id = auth.uid());

CREATE POLICY "Admin can read all movements"
  ON public.stock_movements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Ambassador can insert own movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (ambassador_id = auth.uid());

CREATE POLICY "Admin can insert any movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Ambassador can update own movements"
  ON public.stock_movements FOR UPDATE
  USING (ambassador_id = auth.uid());

CREATE POLICY "Admin can update all movements"
  ON public.stock_movements FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- settings policies
CREATE POLICY "Authenticated users can read settings"
  ON public.settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update settings"
  ON public.settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Trigger: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'ambassador')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Grant access to views for authenticated users
-- ============================================================
GRANT SELECT ON public.v_stock_on_hand TO authenticated;
GRANT SELECT ON public.v_commission_totals TO authenticated;
