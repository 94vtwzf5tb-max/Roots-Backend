import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import CycleSelector from "@/components/CycleSelector";
import { inr } from "@/lib/helpers";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

export default function Variance() {
  const [cycle, setCycle] = useState("O1");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/variance/${cycle}`).then(({data}) => setRows(data)).finally(() => setLoading(false));
  }, [cycle]);

  useEffect(() => {
    api.get("/settings").then(({data}) => {
      if (data.current_cycle) setCycle(data.current_cycle);
    });
  }, []);

  const okCount = rows.filter(r => r.status === "OK").length;
  const checkCount = rows.filter(r => r.status === "CHECK").length;
  const missingCount = rows.filter(r => r.status === "MISSING").length;
  const totalVariance = rows.reduce((s, r) => s + Math.abs(r.variance_value), 0);

  return (
    <div>
      <PageHeader title="Variance Check" subtitle={`Reconcile delivered vs received for cycle ${cycle}`}>
        <CycleSelector value={cycle} onChange={setCycle} label="Cycle" testId="variance-cycle-selector" />
      </PageHeader>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Tile icon={CheckCircle2} label="OK" value={okCount} tone="success" />
          <Tile icon={AlertCircle} label="Check" value={checkCount} tone="warning" />
          <Tile icon={HelpCircle} label="Missing" value={missingCount} tone="danger" />
          <Tile label="Variance Value" value={inr(totalVariance)} tone="default" />
        </div>

        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="roots-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th className="num">Sales Consumption</th>
                  <th className="num">Delivered</th>
                  <th className="num">Received</th>
                  <th className="num">Wastage</th>
                  <th className="num">Expected Balance</th>
                  <th className="num">Variance Qty</th>
                  <th className="num">Variance ₹</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-[#8A8178]">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-[#8A8178]">No data</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} data-testid={`variance-row-${i}`}>
                    <td className="font-medium">{r.ingredient}</td>
                    <td className="text-[#8A8178]">{r.unit}</td>
                    <td className="num">{r.sales_consumption}</td>
                    <td className="num">{r.delivered}</td>
                    <td className="num">{r.received}</td>
                    <td className="num">{r.wastage}</td>
                    <td className="num">{r.expected_balance}</td>
                    <td className="num">
                      <span className={r.variance_qty === 0 ? "text-[#8A8178]" : r.variance_qty > 0 ? "text-[#4C6B56]" : "text-[#B83A3A]"}>
                        {r.variance_qty > 0 ? "+" : ""}{r.variance_qty}
                      </span>
                    </td>
                    <td className="num">{inr(r.variance_value)}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, icon: Icon }) {
  const map = {
    success: "text-[#4C6B56] bg-[#E3EDE6] border-[#4C6B56]/20",
    warning: "text-[#D97B29] bg-[#FDF2E3] border-[#D97B29]/30",
    danger: "text-[#B83A3A] bg-[#F9E5E5] border-[#B83A3A]/20",
    default: "text-[#2D2824] bg-white border-[#E6E2DC]",
  };
  return (
    <div className={`border rounded-md p-5 ${map[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        <div className="text-[11px] font-medium tracking-widest uppercase">{label}</div>
      </div>
      <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    OK: "bg-[#E3EDE6] text-[#4C6B56]",
    CHECK: "bg-[#FDF2E3] text-[#D97B29]",
    MISSING: "bg-[#F9E5E5] text-[#B83A3A]",
  };
  return <span className={`pill ${map[status]}`}>{status}</span>;
}
