interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  warning?: boolean;
}

export default function StatCard({ label, value, sub, warning }: StatCardProps) {
  return (
    <div
      className={`rounded-xl p-4 shadow-sm border ${
        warning ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${warning ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
