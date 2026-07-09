import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ORDER_CYCLES, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Forecast() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/forecasts");
    setRows(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateCell = (id, field, cycle, value) => {
    const num = value === "" ? 0 : parseFloat(value);
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: { ...(r[field] || {}), [cycle]: isNaN(num) ? 0 : num } };
    }));
    setDirty(d => ({ ...d, [id]: true }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toSave = rows.filter(r => dirty[r.id]);
      await Promise.all(toSave.map(r => api.put(`/forecasts/${r.id}`, r)));
      setDirty({});
      toast.success(`Saved ${toSave.length} forecast${toSave.length !== 1 ? "s" : ""}`);
    } catch (e) {
      toast.error("Save failed");
    } finally { setSaving(false); }
  };

  const totals = useMemo(() => {
    return rows.map(r => {
      const qty = ORDER_CYCLES.reduce((s, c) => s + (parseFloat(r.forecast?.[c]) || 0), 0);
      return { id: r.id, qty, sales: qty * (r.selling_price || 0) };
    });
  }, [rows]);

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div>
      <PageHeader
        title="SKU Forecast"
        subtitle="Enter last sales & forecast per cycle for each menu item"
      >
        {hasDirty && <div className="text-[12px] text-[#D97B29]">Unsaved changes</div>}
        <button
          data-testid="save-forecasts-btn"
          disabled={!hasDirty || saving}
          onClick={saveAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] rounded-md"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save All"}
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
            <table className="roots-table" style={{ minWidth: 1400 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#F1EFEB]">SKU / Menu Item</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  {ORDER_CYCLES.map(c => (
                    <th key={c} className="num">{c} Fcst</th>
                  ))}
                  <th className="num bg-[#F1EFEB]">Total Qty</th>
                  <th className="num bg-[#F1EFEB]">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={ORDER_CYCLES.length + 5} className="text-center py-8 text-[#8A8178]">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={ORDER_CYCLES.length + 5} className="text-center py-12 text-[#8A8178]">
                    No SKUs yet. Add recipes first — SKUs will auto-populate here.
                  </td></tr>
                ) : rows.map((r, idx) => {
                  const t = totals[idx];
                  return (
                    <tr key={r.id} data-testid={`forecast-row-${r.id}`}>
                      <td className="sticky left-0 z-10 bg-inherit font-medium">{r.sku_menu_item}</td>
                      <td><span className="pill bg-[#F1EFEB] text-[#5B544D]">{r.category}</span></td>
                      <td className="num">{inr(r.selling_price)}</td>
                      {ORDER_CYCLES.map(c => (
                        <td key={c} className="num p-0">
                          <input
                            data-testid={`forecast-${r.id}-${c}`}
                            type="number"
                            className="inline-input"
                            value={r.forecast?.[c] ?? ""}
                            onChange={e => updateCell(r.id, "forecast", c, e.target.value)}
                            step="0.01"
                          />
                        </td>
                      ))}
                      <td className="num font-medium bg-[#FAF9F7]">{t.qty}</td>
                      <td className="num font-medium bg-[#FAF9F7]">{inr(t.sales)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
