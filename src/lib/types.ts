export type UserRole = 'admin' | 'ambassador';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Settings {
  id: number;
  commission_per_unit: number;
  retail_price: number;
  wholesale_price: number;
  low_stock_threshold: number;
}

export interface Sale {
  id: string;
  ambassador_id: string;
  sold_at: string;
  qty: number;
  payment_method: string;
  note: string | null;
  is_void: boolean;
  created_at: string;
}

export interface StockMovement {
  id: string;
  ambassador_id: string;
  type: 'IN' | 'SALE' | 'ADJUSTMENT';
  qty: number;
  occurred_at: string;
  note: string | null;
  sale_id: string | null;
  is_void: boolean;
  created_at: string;
}

export interface StockOnHand {
  ambassador_id: string;
  stock: number;
}

export interface CommissionTotals {
  ambassador_id: string;
  units_sold_total: number;
  commission_total: number;
}

export interface DashboardData {
  stock: number;
  soldThisMonth: number;
  soldTotal: number;
  commissionMonth: number;
  commissionTotal: number;
  lowStockThreshold: number;
  retailPrice: number;
  wholesalePrice: number;
  commissionPerUnit: number;
  dailySales: { date: string; qty: number }[];
}

export interface AmbassadorSummary {
  id: string;
  name: string;
  stock: number;
  sold_this_month: number;
  sold_total: number;
  commission_month: number;
  commission_total: number;
  last_sale_date: string | null;
}
