import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ORDER_CYCLES, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Planning() {
  const [ings, setIngs] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: iData }, { data: pData }] = await Promise.all([
      api.get("/ingredients"),
      api.get("/planning"),
    ]);
    setIngs(iData);
    setPlanning(pData);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const planMap = Object.fromEntries(planning.map(p => [p.ingredient, p]));

  const updateCell = (id, field, cycle, value) => {
    const num = value === "" ? 0 : parseFloat(value);
    setIngs(rs => rs.map(r => r.id === id
      ? { ...r, [field]: { ...(r[field] || {}), [cycle]: isNaN(num) ? 0 : num } } : r));
    setDirty(d => ({ ...d, [id]: true }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toSave = ings.filter(r => dirty[r.id]);
      await Promise.all(toSave.map(r => api.put(`/ingredients/${r.id}`, r)));
      setDirty({});
      toast.success(`Saved ${toSave.length} update${toSave.length !== 1 ? "s" : ""}`);
      // Reload planning to reflect new to-order values
      const { data } = await api.get("/planning");
      setPlanning(data);
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div>
      <PageHeader title="Cycle Planning" subtitle="Enter inventory & wastage per cycle. To-Order and Order Value auto-compute.">
        {hasDirty && <div className="text-[12px] text-[#D97B29]">Unsaved changes</div>}
        <button
          data-testid="save-planning-btn"
          disabled={!hasDirty || saving}
          onClick={saveAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-50 text-white text-[13px] rounded-md"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save Inventory"}
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            <table className="roots-table" style={{ minWidth: 2400 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#F1EFEB]">Ingredient</th>
                  <th>Unit</th>
                  <th className="num">Cost</th>
                  <th className="num">Buffer%</th>
                  {ORDER_CYCLES.map(c => (
                    <th key={c} colSpan={4} className="text-center border-l border-[#E6E2DC]">{c}</th>
                  ))}
                  <th className="num bg-[#F1EFEB]">Monthly Order</th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#F1EFEB]"></th>
                  <th></th><th></th><th></th>
                  {ORDER_CYCLES.map(c => (
                    <>
                      <th key={c+"r"} className="num text-[10px] border-l border-[#E6E2DC]">Req</th>
                      <th key={c+"i"} className="num text-[10px]">Inv</th>
                      <th key={c+"w"} className="num text-[10px]">Wast</th>
                      <th key={c+"o"} className="num text-[10px] bg-[#F6F1EA]">Order</th>
                    </>
                  ))}
                  <th className="num bg-[#F1EFEB]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={45} className="text-center py-8 text-[#8A8178]">Loading…</td></tr>
                ) : ings.length === 0 ? (
                  <tr><td colSpan={45} className="text-center py-12 text-[#8A8178]">
                    No ingredients yet. Add recipes first — ingredients will auto-populate here.
                  </td></tr>
                ) : ings.map(r => {
                  const p = planMap[r.ingredient];
                  return (
                    <tr key={r.id} data-testid={`plan-row-${r.id}`}>
                      <td className="sticky left-0 z-10 bg-inherit font-medium">{r.ingredient}</td>
                      <td className="text-[#8A8178]">{r.unit}</td>
                      <td className="num">{inr(r.cost_per_unit)}</td>
                      <td className="num">{(r.buffer_pct * 100).toFixed(0)}%</td>
                      {ORDER_CYCLES.map(c => {
                        const pc = p?.cycles?.[c] || {};
                        return (
                          <>
                            <td key={c+"r"} className="num text-[#5B544D] border-l border-[#E6E2DC]">
                              {pc.required || 0}
                            </td>
                            <td key={c+"i"} className="num p-0">
                              <input
                                data-testid={`inv-${r.id}-${c}`}
                                type="number"
                                className="inline-input"
                                value={r.inventory?.[c] ?? ""}
                                onChange={e => updateCell(r.id, "inventory", c, e.target.value)}
                              />
                            </td>
                            <td key={c+"w"} className="num p-0">
                              <input
                                data-testid={`wast-${r.id}-${c}`}
                                type="number"
                                className="inline-input"
                                value={r.wastage?.[c] ?? ""}
                                onChange={e => updateCell(r.id, "wastage", c, e.target.value)}
                              />
                            </td>
                            <td key={c+"o"} className="num font-medium bg-[#F6F1EA]">
                              <span className={pc.to_order > 0 ? "text-[#A44200]" : "text-[#8A8178]"}>
                                {pc.to_order || 0}
                              </span>
                            </td>
                          </>
                        );
                      })}
                      <td className="num font-medium bg-[#F1EFEB]">{inr(p?.monthly_value || 0)}</td>
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
