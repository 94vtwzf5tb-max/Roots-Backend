import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { inr, ORDER_CYCLES } from "@/lib/helpers";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid
} from "recharts";
import { TrendingUp, AlertTriangle, Wallet, PackageOpen, Activity } from "lucide-react";

function Kpi({ label, value, sub, tone = "default", icon: Icon }) {
  const toneMap = {
    default: "text-[#2D2824]",
    success: "text-[#4C6B56]",
    warning: "text-[#D97B29]",
    danger: "text-[#B83A3A]",
  };
  return (
    <div className="bg-white border border-[#E6E2DC] rounded-md p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-[#8A8178] tracking-widest uppercase">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-[#8A8178]" />}
      </div>
      <div className={`font-display text-[30px] font-bold tracking-tight ${toneMap[tone]}`}>{value}</div>
      {sub && <div className="text-[12px] text-[#8A8178]">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/summary").then(({data}) => { setSummary(data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-[#8A8178]">Loading…</div>;
  if (!summary) return null;

  const healthTone = summary.health_score >= 80 ? "success" : summary.health_score >= 50 ? "warning" : "danger";
  const wastageTone = summary.avg_wastage_pct <= 5 ? "success" : summary.avg_wastage_pct <= 10 ? "warning" : "danger";

  const chartData = summary.cycles.map(c => ({
    cycle: c.cycle,
    Sales: c.forecast_sales,
    Order: c.order_value,
    Wastage: c.wastage_value,
  }));

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`Current cycle · ${summary.current_cycle} · ${summary.business_name}`}
      >
        <div className="pill bg-[#F1EFEB] text-[#5B544D]">Cycle {summary.current_cycle}</div>
      </PageHeader>

      <div className="p-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-grid">
          <Kpi label="Health Score" value={`${summary.health_score}/100`} tone={healthTone}
               sub={summary.health_score >= 80 ? "Healthy operations" : "Needs attention"}
               icon={Activity} />
          <Kpi label="Avg Wastage" value={`${summary.avg_wastage_pct}%`} tone={wastageTone}
               sub={`${inr(summary.monthly_wastage_value)} value`}
               icon={AlertTriangle} />
          <Kpi label="Monthly Order Value" value={inr(summary.monthly_order_value)}
               sub={`${summary.order_to_sales_ratio_pct}% of forecast sales`}
               icon={Wallet} />
          <Kpi label="Forecast Sales" value={inr(summary.monthly_forecast_sales)}
               sub={`${summary.total_skus} SKUs · ${summary.total_ingredients} ingredients`}
               icon={TrendingUp} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E6E2DC] rounded-md p-5">
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#8A8178] tracking-widest uppercase">Sales vs Order Value</div>
              <div className="font-display text-lg font-semibold text-[#2D2824] mt-0.5">Cycle-wise performance</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DC" />
                  <XAxis dataKey="cycle" stroke="#8A8178" fontSize={11} />
                  <YAxis stroke="#8A8178" fontSize={11} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #E6E2DC", borderRadius: 6 }} />
                  <Line type="monotone" dataKey="Sales" stroke="#4C6B56" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Order" stroke="#A44200" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-[#E6E2DC] rounded-md p-5">
            <div className="mb-4">
              <div className="text-[11px] font-medium text-[#8A8178] tracking-widest uppercase">Wastage by Cycle</div>
              <div className="font-display text-lg font-semibold text-[#2D2824] mt-0.5">Value lost per cycle</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E2DC" />
                  <XAxis dataKey="cycle" stroke="#8A8178" fontSize={11} />
                  <YAxis stroke="#8A8178" fontSize={11} />
                  <Tooltip contentStyle={{ fontSize: 12, border: "1px solid #E6E2DC", borderRadius: 6 }} />
                  <Bar dataKey="Wastage" fill="#D97B29" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Cycle Table */}
        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2DC]">
            <div className="font-display text-lg font-semibold text-[#2D2824]">Cycle Summary</div>
            <div className="text-[12px] text-[#8A8178]">KPIs across all order cycles</div>
          </div>
          <div className="overflow-x-auto">
            <table className="roots-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th className="num">Forecast Sales</th>
                  <th className="num">Order Value</th>
                  <th className="num">Items to Order</th>
                  <th className="num">Wastage Value</th>
                  <th className="num">Wastage %</th>
                </tr>
              </thead>
              <tbody>
                {summary.cycles.map(c => (
                  <tr key={c.cycle} data-testid={`summary-row-${c.cycle}`}>
                    <td className="font-medium">{c.cycle}</td>
                    <td className="num">{inr(c.forecast_sales)}</td>
                    <td className="num">{inr(c.order_value)}</td>
                    <td className="num">{c.items_to_order}</td>
                    <td className="num">{inr(c.wastage_value)}</td>
                    <td className="num">
                      <span className={c.wastage_pct > 5 ? "text-[#D97B29] font-medium" : ""}>
                        {c.wastage_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {summary.total_ingredients === 0 && (
          <div className="bg-[#FDF2E3] border border-[#D97B29]/30 rounded-md p-6 text-center">
            <PackageOpen className="w-8 h-8 text-[#D97B29] mx-auto mb-2" />
            <div className="font-display text-lg font-semibold text-[#2D2824] mb-1">No data yet</div>
            <div className="text-[13px] text-[#5B544D] mb-4">Start by adding recipes in <b>Recipe Mapping</b>, then enter forecasts.</div>
            <a href="/recipes" className="inline-block px-4 py-2 bg-[#A44200] text-white text-[13px] rounded-md">Add first recipe</a>
          </div>
        )}
      </div>
    </div>
  );
}
