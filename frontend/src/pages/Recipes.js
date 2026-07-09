import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatApiError, SKU_CATEGORIES, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Plus, Trash2, Search, X } from "lucide-react";

const empty = { ingredient: "", unit: "g/ml/pcs", sku_menu_item: "", qty_per_sku: 0, cost_per_unit: 0, category: "Other", selling_price: 0 };

export default function Recipes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/recipes");
    setRows(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/recipes/${editId}`, form);
        toast.success("Recipe updated");
      } else {
        await api.post("/recipes", form);
        toast.success("Recipe added");
      }
      setShowForm(false); setForm(empty); setEditId(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const del = async (id) => {
    if (!confirm("Delete this recipe entry?")) return;
    await api.delete(`/recipes/${id}`);
    toast.success("Deleted");
    load();
  };

  const edit = (row) => {
    setForm({
      ingredient: row.ingredient, unit: row.unit, sku_menu_item: row.sku_menu_item,
      qty_per_sku: row.qty_per_sku, cost_per_unit: row.cost_per_unit,
      category: row.category, selling_price: row.selling_price,
    });
    setEditId(row.id); setShowForm(true);
  };

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.ingredient.toLowerCase().includes(s) || r.sku_menu_item.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader title="Recipe Mapping" subtitle="Map ingredients to SKU / menu items with quantities and cost">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8178]" />
          <input
            data-testid="recipe-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-[13px] bg-white border border-[#E6E2DC] rounded-md w-52 focus:outline-none focus:border-[#A44200]"
          />
        </div>
        <button
          data-testid="add-recipe-btn"
          onClick={() => { setShowForm(true); setForm(empty); setEditId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] text-white text-[13px] rounded-md"
        >
          <Plus className="w-3.5 h-3.5" /> Add Recipe
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
            <table className="roots-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th>SKU / Menu Item</th>
                  <th>Category</th>
                  <th className="num">Qty/SKU</th>
                  <th className="num">Cost/Unit</th>
                  <th className="num">Selling Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-[#8A8178]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[#8A8178]">
                    {rows.length === 0 ? "No recipes yet. Add your first one." : "No matches."}
                  </td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} data-testid={`recipe-row-${r.id}`}>
                    <td className="font-medium text-[#2D2824]">{r.ingredient}</td>
                    <td className="text-[#8A8178]">{r.unit}</td>
                    <td>{r.sku_menu_item}</td>
                    <td><span className="pill bg-[#F1EFEB] text-[#5B544D]">{r.category}</span></td>
                    <td className="num">{r.qty_per_sku}</td>
                    <td className="num">{inr(r.cost_per_unit)}</td>
                    <td className="num">{inr(r.selling_price)}</td>
                    <td className="text-right">
                      <button onClick={() => edit(r)} className="text-[12px] text-[#5B544D] hover:text-[#A44200] px-2">Edit</button>
                      <button onClick={() => del(r.id)} data-testid={`delete-recipe-${r.id}`} className="text-[#B83A3A] hover:bg-[#F9E5E5] p-1 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#E6E2DC] w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E2DC]">
              <h2 className="font-display font-semibold text-lg">{editId ? "Edit Recipe" : "Add Recipe"}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#8A8178] hover:text-[#2D2824]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ingredient" required data-testid="form-ingredient" value={form.ingredient} onChange={v => setForm({...form, ingredient: v})} />
                <Field label="Unit" data-testid="form-unit" value={form.unit} onChange={v => setForm({...form, unit: v})} />
              </div>
              <Field label="SKU / Menu Item" required data-testid="form-sku" value={form.sku_menu_item} onChange={v => setForm({...form, sku_menu_item: v})} />
              <div>
                <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Category</label>
                <select data-testid="form-category" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] bg-white">
                  {SKU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Qty/SKU" type="number" data-testid="form-qty" value={form.qty_per_sku} onChange={v => setForm({...form, qty_per_sku: parseFloat(v) || 0})} step="0.01" />
                <Field label="Cost/Unit (₹)" type="number" data-testid="form-cost" value={form.cost_per_unit} onChange={v => setForm({...form, cost_per_unit: parseFloat(v) || 0})} step="0.01" />
                <Field label="Selling Price (₹)" type="number" data-testid="form-price" value={form.selling_price} onChange={v => setForm({...form, selling_price: parseFloat(v) || 0})} step="0.01" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-[13px] border border-[#E6E2DC] rounded-md hover:bg-[#F6F1EA]">Cancel</button>
                <button type="submit" data-testid="form-submit" className="px-4 py-2 text-[13px] bg-[#A44200] hover:bg-[#823400] text-white rounded-md">
                  {editId ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, step, ...rest }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">{label}</label>
      <input
        type={type} value={value} step={step} required={required}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15"
        {...rest}
      />
    </div>
  );
}
