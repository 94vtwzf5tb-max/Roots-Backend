import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ORDER_CYCLES, STOCK_CATEGORIES } from "@/lib/helpers";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);
  const [ings, setIngs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirtyIngs, setDirtyIngs] = useState({});

  useEffect(() => {
    api.get("/settings").then(({data}) => setS(data));
    api.get("/ingredients").then(({data}) => setIngs(data));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", s);
      const toSave = ings.filter(i => dirtyIngs[i.id]);
      await Promise.all(toSave.map(i => api.put(`/ingredients/${i.id}`, i)));
      setDirtyIngs({});
      toast.success("Settings saved");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const updateIng = (id, patch) => {
    setIngs(is => is.map(i => i.id === id ? { ...i, ...patch } : i));
    setDirtyIngs(d => ({ ...d, [id]: true }));
  };

  if (!s) return <div className="p-8 text-[#8A8178]">Loading…</div>;

  return (
    <div>
      <PageHeader title="Setup" subtitle="Business config & ingredient categorization">
        <button data-testid="save-settings-btn" onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] text-white text-[13px] rounded-md">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </PageHeader>

      <div className="p-8 space-y-8 max-w-5xl">
        <section className="bg-white border border-[#E6E2DC] rounded-md p-6">
          <h2 className="font-display font-semibold text-[16px] text-[#2D2824] mb-4">Business Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Business Name" value={s.business_name} onChange={v => setS({...s, business_name: v})} />
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Current Order Cycle</label>
              <select data-testid="setup-cycle" value={s.current_cycle} onChange={e => setS({...s, current_cycle: e.target.value})}
                className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] bg-white">
                {ORDER_CYCLES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Weeks in Month" type="number" step="0.5" value={s.weeks_in_month} onChange={v => setS({...s, weeks_in_month: parseFloat(v) || 0})} />
            <Field label="Orders per Week" type="number" step="0.5" value={s.orders_per_week} onChange={v => setS({...s, orders_per_week: parseFloat(v) || 0})} />
            <Field label="Default Buffer %" type="number" step="0.01" value={s.default_buffer_pct} onChange={v => setS({...s, default_buffer_pct: parseFloat(v) || 0})} />
            <Field label="Wastage Alert %" type="number" step="0.01" value={s.wastage_alert_pct} onChange={v => setS({...s, wastage_alert_pct: parseFloat(v) || 0})} />
            <Field label="Order Value Alert %" type="number" step="0.01" value={s.order_value_alert_pct} onChange={v => setS({...s, order_value_alert_pct: parseFloat(v) || 0})} />
          </div>
        </section>

        <section className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="font-display font-semibold text-[16px] text-[#2D2824]">Ingredient Categorization</h2>
            <p className="text-[13px] text-[#8A8178] mt-1">Assign each ingredient to a stock category so the order sheet groups them correctly.</p>
          </div>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="roots-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th>Stock Category</th>
                  <th className="num">Yield %</th>
                  <th className="num">Buffer %</th>
                </tr>
              </thead>
              <tbody>
                {ings.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[#8A8178]">No ingredients yet</td></tr>
                ) : ings.map(i => (
                  <tr key={i.id} data-testid={`ing-row-${i.id}`}>
                    <td className="font-medium">{i.ingredient}</td>
                    <td className="text-[#8A8178]">{i.unit}</td>
                    <td>
                      <select
                        data-testid={`ing-cat-${i.id}`}
                        value={i.stock_category}
                        onChange={e => updateIng(i.id, { stock_category: e.target.value })}
                        className="px-2 py-1 border border-[#E6E2DC] rounded text-[13px] bg-white"
                      >
                        {STOCK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="num p-0">
                      <input type="number" className="inline-input" step="0.01" min="0" max="1"
                        value={i.yield_pct}
                        onChange={e => updateIng(i.id, { yield_pct: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="num p-0">
                      <input type="number" className="inline-input" step="0.01" min="0" max="1"
                        value={i.buffer_pct}
                        onChange={e => updateIng(i.id, { buffer_pct: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", step, ...rest }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">{label}</label>
      <input type={type} value={value} step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15"
        {...rest}
      />
    </div>
  );
}
