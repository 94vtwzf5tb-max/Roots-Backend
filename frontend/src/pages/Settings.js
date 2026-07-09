import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ORDER_CYCLES, STOCK_CATEGORIES, formatApiError } from "@/lib/helpers";
import { toast } from "sonner";
import { Save, Upload, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { readOnly } = useAuth();
  const [s, setS] = useState(null);
  const [ings, setIngs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirtyIngs, setDirtyIngs] = useState({});
  const [importing, setImporting] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const loadAll = () => {
    api.get("/settings").then(({data}) => setS(data));
    api.get("/ingredients").then(({data}) => setIngs(data));
  };
  useEffect(() => { loadAll(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", s);
      const toSave = ings.filter(i => dirtyIngs[i.id]);
      const results = await Promise.all(toSave.map(i => api.put(`/ingredients/${i.id}`, i)));
      setDirtyIngs({});
      const totalPropagated = results.reduce((sum, r) => sum + (r.data?.recipes_updated || 0), 0);
      if (totalPropagated > 0) {
        toast.success(`Settings saved · ${totalPropagated} recipe row${totalPropagated !== 1 ? "s" : ""} auto-updated`);
      } else {
        toast.success("Settings saved");
      }
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const updateIng = (id, patch) => {
    setIngs(is => is.map(i => i.id === id ? { ...i, ...patch } : i));
    setDirtyIngs(d => ({ ...d, [id]: true }));
  };

  const setDate = (cycle, date) => {
    setS(prev => ({ ...prev, cycle_dates: { ...(prev.cycle_dates || {}), [cycle]: date || null } }));
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Import "${file.name}"?${replaceOnImport ? "\n\nThis will REPLACE all existing recipes, ingredients, and forecasts." : ""}`)) {
      e.target.value = "";
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/import/excel?replace=${replaceOnImport}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setImportResult(data);
      toast.success(`Imported: ${data.recipes_created} recipes, ${data.skus_created} SKUs`);
      loadAll();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!s) return <div className="p-8 text-[#8A8178]">Loading…</div>;

  return (
    <div>
      <PageHeader title="Setup" subtitle="Business config, cycle dates, imports & ingredient categorization">
        <button data-testid="save-settings-btn" onClick={save} disabled={saving || readOnly}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] rounded-md">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </PageHeader>

      <div className="p-8 space-y-8 max-w-6xl">
        {/* Excel Import */}
        <section className="bg-gradient-to-br from-[#FDF2E3] to-[#F9F8F6] border border-[#D97B29]/30 rounded-md p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-[#D97B29] flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-[16px] text-[#2D2824]">Import from Excel</h2>
              <p className="text-[13px] text-[#5B544D] mt-1">
                Upload your AMBALA CITY ORDER SHEET workbook. Auto-imports <span className="font-medium">Setup</span>, <span className="font-medium">Recipe Mapping</span>, and <span className="font-medium">SKU Forecast</span> sheets.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={onImport}
                  disabled={importing}
                  className="hidden"
                  data-testid="import-file-input"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importing || readOnly}
                  data-testid="import-excel-btn"
                  className="flex items-center gap-2 px-4 py-2 bg-[#A44200] hover:bg-[#823400] disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] rounded-md"
                >
                  <Upload className="w-3.5 h-3.5" /> {importing ? "Importing…" : "Choose Excel File"}
                </button>
                <label className="flex items-center gap-2 text-[13px] text-[#5B544D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceOnImport}
                    onChange={e => setReplaceOnImport(e.target.checked)}
                    className="accent-[#A44200]"
                    data-testid="import-replace-toggle"
                  />
                  Replace existing data
                </label>
              </div>

              {replaceOnImport && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[#B83A3A] bg-[#F9E5E5] px-3 py-1.5 rounded">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  All recipes, ingredients & forecasts will be deleted before import.
                </div>
              )}

              {importResult && (
                <div className="mt-4 bg-white border border-[#E6E2DC] rounded-md p-3 text-[13px]" data-testid="import-result">
                  <div className="font-medium text-[#2D2824] mb-2">Import summary</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                    <div><span className="text-[#8A8178]">Recipes created:</span> <span className="font-medium">{importResult.recipes_created}</span></div>
                    <div><span className="text-[#8A8178]">Recipes skipped:</span> <span className="font-medium">{importResult.recipes_skipped}</span></div>
                    <div><span className="text-[#8A8178]">SKUs seeded:</span> <span className="font-medium">{importResult.skus_created}</span></div>
                    <div><span className="text-[#8A8178]">Settings:</span> <span className="font-medium">{importResult.settings_updated ? "Updated" : "Skipped"}</span></div>
                  </div>
                  <div className="mt-2 text-[11px] text-[#8A8178]">Sheets found: {importResult.sheets_found?.join(", ")}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Business Configuration */}
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

        {/* Cycle Dates */}
        <section className="bg-white border border-[#E6E2DC] rounded-md p-6">
          <h2 className="font-display font-semibold text-[16px] text-[#2D2824]">Cycle Dates</h2>
          <p className="text-[13px] text-[#8A8178] mt-1 mb-4">Assign an actual calendar date to each of the 10 order cycles. Dates appear in the cycle picker and Order screen.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ORDER_CYCLES.map(c => (
              <div key={c} className={`border rounded-md px-3 py-2 ${c === s.current_cycle ? "border-[#A44200] bg-[#FDF2E3]" : "border-[#E6E2DC] bg-white"}`}>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-[#5B544D]">
                  {c} {c === s.current_cycle && <span className="ml-1 text-[#A44200]">· current</span>}
                </label>
                <input
                  type="date"
                  data-testid={`cycle-date-${c}`}
                  value={(s.cycle_dates && s.cycle_dates[c]) || ""}
                  onChange={e => setDate(c, e.target.value)}
                  className="w-full mt-1 px-2 py-1 border border-[#E6E2DC] rounded text-[13px] focus:outline-none focus:border-[#A44200] font-mono"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Ingredient Categorization */}
        <section className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="font-display font-semibold text-[16px] text-[#2D2824]">Ingredient Categorization & Cost</h2>
            <p className="text-[13px] text-[#8A8178] mt-1">
              Assign stock category, yield %, buffer %. <span className="font-medium">Changing cost here auto-updates all recipe rows using that ingredient.</span>
            </p>
          </div>
          <div className="overflow-x-auto max-h-[520px]">
            <table className="roots-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th>Stock Category</th>
                  <th className="num">Cost/Unit (₹)</th>
                  <th className="num">Yield %</th>
                  <th className="num">Buffer %</th>
                </tr>
              </thead>
              <tbody>
                {ings.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[#8A8178]">No ingredients yet</td></tr>
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
                      <input type="number" className="inline-input" step="0.01" min="0"
                        data-testid={`ing-cost-${i.id}`}
                        value={i.cost_per_unit}
                        onChange={e => updateIng(i.id, { cost_per_unit: parseFloat(e.target.value) || 0 })}
                      />
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
