import { useEffect, useState, useMemo, Fragment } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ORDER_CYCLES, inr, SKU_CATEGORIES } from "@/lib/helpers";
import { toast } from "sonner";
import { Save, ToggleLeft, ToggleRight } from "lucide-react";

export default function Forecast() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [showLastSales, setShowLastSales] = useState(false);

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

  const updateMeta = (id, field, value) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r));
    setDirty(d => ({ ...d, [id]: true }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toSave = rows.filter(r => dirty[r.id]);
      await Promise.all(toSave.map(r => api.put(`/forecasts/${r.id}`, r)));
      setDirty({});
      toast.success(`Saved ${toSave.length} forecast${toSave.length !== 1 ? "s" : ""}`);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const totals = useMemo(() => {
    return rows.map(r => {
      const qty = ORDER_CYCLES.reduce((s, c) => s + (parseFloat(r.forecast?.[c]) || 0), 0);
      return { id: r.id, qty, sales: qty * (r.selling_price || 0) };
    });
  }, [rows]);

  const hasDirty = Object.keys(dirty).length > 0;
  const colCount = ORDER_CYCLES.length * (showLastSales ? 2 : 1) + 5;

  return (
    <div>
      <PageHeader
        title="SKU Forecast"
        subtitle="Everything below is inline-editable — click any cell"
      >
        <button
          data-testid="toggle-last-sales"
          onClick={() => setShowLastSales(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E6E2DC] hover:bg-[#F6F1EA] text-[#5B544D] text-[13px] rounded-md"
        >
          {showLastSales ? <ToggleRight className="w-4 h-4 text-[#A44200]" /> : <ToggleLeft className="w-4 h-4" />}
          Show Last Sales
        </button>
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
            <table className="roots-table" style={{ minWidth: showLastSales ? 2200 : 1400 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#F1EFEB]">SKU / Menu Item</th>
                  <th>Category</th>
                  <th className="num">Selling Price</th>
                  {ORDER_CYCLES.map(c => (
                    showLastSales ? (
                      <Fragment key={c}>
                        <th className="num border-l border-[#E6E2DC]" style={{ fontSize: 10 }}>{c} Last</th>
                        <th className="num" style={{ fontSize: 10 }}>{c} Fcst</th>
                      </Fragment>
                    ) : (
                      <th key={c} className="num">{c} Fcst</th>
                    )
                  ))}
                  <th className="num bg-[#F1EFEB]">Total Qty</th>
                  <th className="num bg-[#F1EFEB]">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={colCount} className="text-center py-8 text-[#8A8178]">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={colCount} className="text-center py-12 text-[#8A8178]">
                    No SKUs yet. Add recipes first — SKUs will auto-populate here.
                  </td></tr>
                ) : rows.map((r, idx) => {
                  const t = totals[idx];
                  return (
                    <tr key={r.id} data-testid={`forecast-row-${r.id}`}>
                      <td className="sticky left-0 z-10 bg-inherit font-medium">{r.sku_menu_item}</td>
                      <td className="p-0">
                        <select
                          data-testid={`fc-cat-${r.id}`}
                          value={r.category}
                          onChange={e => updateMeta(r.id, "category", e.target.value)}
                          className="w-full px-2 py-1 border-0 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#A44200] text-[13px]"
                        >
                          {SKU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="num p-0">
                        <input
                          type="number" step="0.01"
                          data-testid={`fc-price-${r.id}`}
                          className="inline-input"
                          value={r.selling_price ?? ""}
                          onChange={e => updateMeta(r.id, "selling_price", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      {ORDER_CYCLES.map(c => {
                        if (showLastSales) {
                          return (
                            <Fragment key={c}>
                              <td className="num p-0 border-l border-[#E6E2DC]">
                                <input
                                  data-testid={`last-sales-${r.id}-${c}`}
                                  type="number" step="0.01" className="inline-input"
                                  value={r.last_sales?.[c] ?? ""}
                                  onChange={e => updateCell(r.id, "last_sales", c, e.target.value)}
                                />
                              </td>
                              <td className="num p-0">
                                <input
                                  data-testid={`forecast-${r.id}-${c}`}
                                  type="number" step="0.01" className="inline-input"
                                  value={r.forecast?.[c] ?? ""}
                                  onChange={e => updateCell(r.id, "forecast", c, e.target.value)}
                                />
                              </td>
                            </Fragment>
                          );
                        }
                        return (
                          <td key={c} className="num p-0">
                            <input
                              data-testid={`forecast-${r.id}-${c}`}
                              type="number" step="0.01" className="inline-input"
                              value={r.forecast?.[c] ?? ""}
                              onChange={e => updateCell(r.id, "forecast", c, e.target.value)}
                            />
                          </td>
                        );
                      })}
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
