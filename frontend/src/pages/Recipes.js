import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatApiError, SKU_CATEGORIES, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Plus, Trash2, Search, X, ChefHat, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const emptyLine = () => ({ ingredient: "", unit: "g/ml/pcs", qty_per_sku: 0, cost_per_unit: 0 });
const emptyRecipe = () => ({
  sku_menu_item: "",
  category: "Other",
  selling_price: 0,
  ingredients: [emptyLine()],
  replace_existing: false,
});

export default function Recipes() {
  const { readOnly } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRecipe());
  const [editingSku, setEditingSku] = useState(null); // null=new, string=edit-existing
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/recipes");
    setRows(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Group recipes by menu item
  const grouped = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.sku_menu_item]) {
        map[r.sku_menu_item] = {
          sku_menu_item: r.sku_menu_item,
          category: r.category,
          selling_price: r.selling_price,
          ingredients: [],
          total_cost: 0,
        };
      }
      map[r.sku_menu_item].ingredients.push(r);
      map[r.sku_menu_item].total_cost += (r.qty_per_sku || 0) * (r.cost_per_unit || 0);
    });
    return Object.values(map);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!q) return grouped;
    const s = q.toLowerCase();
    return grouped.filter(g =>
      g.sku_menu_item.toLowerCase().includes(s) ||
      g.ingredients.some(i => i.ingredient.toLowerCase().includes(s))
    );
  }, [grouped, q]);

  const openNew = () => {
    setForm(emptyRecipe());
    setEditingSku(null);
    setShowForm(true);
  };

  const openEdit = (group) => {
    setForm({
      sku_menu_item: group.sku_menu_item,
      category: group.category,
      selling_price: group.selling_price,
      replace_existing: true,
      ingredients: group.ingredients.map(i => ({
        ingredient: i.ingredient, unit: i.unit,
        qty_per_sku: i.qty_per_sku, cost_per_unit: i.cost_per_unit,
      })),
    });
    setEditingSku(group.sku_menu_item);
    setShowForm(true);
  };

  const addLine = () => setForm(f => ({ ...f, ingredients: [...f.ingredients, emptyLine()] }));
  const removeLine = (idx) => setForm(f => ({
    ...f, ingredients: f.ingredients.filter((_, i) => i !== idx)
  }));
  const setLine = (idx, patch) => setForm(f => ({
    ...f, ingredients: f.ingredients.map((l, i) => i === idx ? { ...l, ...patch } : l),
  }));

  const submit = async (e) => {
    e.preventDefault();
    const valid = form.ingredients.filter(i => i.ingredient.trim() !== "");
    if (valid.length === 0) return toast.error("Add at least one ingredient");
    if (!form.sku_menu_item.trim()) return toast.error("Menu item name required");

    try {
      await api.post("/recipes/bulk", {
        sku_menu_item: form.sku_menu_item.trim(),
        category: form.category,
        selling_price: form.selling_price,
        ingredients: valid,
        replace_existing: form.replace_existing || !!editingSku,
      });
      toast.success(editingSku ? "Recipe updated" : `Recipe added with ${valid.length} ingredients`);
      setShowForm(false);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const delSku = async (sku) => {
    if (!window.confirm(`Delete recipe "${sku}" and all its ingredients?`)) return;
    await api.delete(`/recipes/sku/${encodeURIComponent(sku)}`);
    toast.success("Recipe deleted");
    load();
  };

  const delOne = async (id) => {
    if (!window.confirm("Delete this ingredient line?")) return;
    await api.delete(`/recipes/${id}`);
    load();
  };

  const saveLineField = async (line, field, rawValue) => {
    const value = parseFloat(rawValue) || 0;
    if (value === line[field]) return; // no-op
    try {
      await api.put(`/recipes/${line.id}`, {
        ingredient: line.ingredient, unit: line.unit,
        sku_menu_item: line.sku_menu_item, qty_per_sku: line.qty_per_sku,
        cost_per_unit: line.cost_per_unit, category: line.category,
        selling_price: line.selling_price, [field]: value,
      });
      toast.success(`${line.ingredient}: ${field} updated`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const totalCost = form.ingredients.reduce((s, l) => s + (parseFloat(l.qty_per_sku) || 0) * (parseFloat(l.cost_per_unit) || 0), 0);
  const margin = (form.selling_price - totalCost);

  return (
    <div>
      <PageHeader title="Recipe Mapping" subtitle="Each menu item can have multiple ingredients — expand a row to see the recipe">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8178]" />
          <input
            data-testid="recipe-search"
            value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-[13px] bg-white border border-[#E6E2DC] rounded-md w-52 focus:outline-none focus:border-[#A44200]"
          />
        </div>
        <button
          data-testid="add-recipe-btn" onClick={openNew}
          disabled={readOnly}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] rounded-md"
        >
          <Plus className="w-3.5 h-3.5" /> Add Recipe
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatTile label="Menu Items" value={grouped.length} />
          <StatTile label="Ingredient Rows" value={rows.length} />
          <StatTile label="Avg Ingredients/Item" value={grouped.length ? (rows.length / grouped.length).toFixed(1) : "0"} />
          <StatTile label="Recipes Above ₹200" value={grouped.filter(g => g.selling_price >= 200).length} />
        </div>

        <div className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#8A8178]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-[#8A8178]">
              <ChefHat className="w-8 h-8 mx-auto mb-3 text-[#8A8178]" />
              {rows.length === 0 ? "No recipes yet. Add your first menu item and its ingredients." : "No matches."}
            </div>
          ) : (
            <div className="divide-y divide-[#E6E2DC]">
              {filtered.map(g => {
                const open = expanded[g.sku_menu_item];
                const cost = g.total_cost;
                const marg = g.selling_price - cost;
                const margPct = g.selling_price > 0 ? (marg / g.selling_price * 100) : 0;
                return (
                  <div key={g.sku_menu_item} data-testid={`sku-group-${g.sku_menu_item}`}>
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [g.sku_menu_item]: !e[g.sku_menu_item] }))}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAF9F7] text-left"
                    >
                      {open ? <ChevronDown className="w-4 h-4 text-[#8A8178]" /> : <ChevronRight className="w-4 h-4 text-[#8A8178]" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#2D2824] text-[14px]">{g.sku_menu_item}</span>
                          <span className="pill bg-[#F1EFEB] text-[#5B544D]">{g.category}</span>
                        </div>
                        <div className="text-[12px] text-[#8A8178] mt-0.5">
                          {g.ingredients.length} ingredient{g.ingredients.length !== 1 ? "s" : ""} · Cost {inr(cost)} · Sells {inr(g.selling_price)} · Margin <span className={margPct < 30 ? "text-[#B83A3A]" : "text-[#4C6B56]"}>{margPct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {!readOnly && (
                          <>
                            <button onClick={() => openEdit(g)} data-testid={`edit-sku-${g.sku_menu_item}`}
                              className="p-2 rounded-md hover:bg-[#F1EFEB] text-[#5B544D]" title="Edit recipe">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => delSku(g.sku_menu_item)} data-testid={`delete-sku-${g.sku_menu_item}`}
                              className="p-2 rounded-md hover:bg-[#F9E5E5] text-[#B83A3A]" title="Delete recipe">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </button>
                    {open && (
                      <div className="bg-[#FAF9F7] px-5 py-3 border-t border-[#E6E2DC]">
                        <table className="roots-table" style={{ background: "transparent" }}>
                          <thead>
                            <tr>
                              <th style={{ background: "transparent" }}>Ingredient</th>
                              <th style={{ background: "transparent" }}>Unit</th>
                              <th className="num" style={{ background: "transparent" }}>Qty/SKU</th>
                              <th className="num" style={{ background: "transparent" }}>Cost/Unit</th>
                              <th className="num" style={{ background: "transparent" }}>Line Cost</th>
                              <th style={{ background: "transparent" }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.ingredients.map(i => (
                              <tr key={i.id} style={{ background: "transparent" }} data-testid={`recipe-line-${i.id}`}>
                                <td>{i.ingredient}</td>
                                <td className="text-[#8A8178]">{i.unit}</td>
                                <td className="num p-0">
                                  <input
                                    type="number" step="0.01" defaultValue={i.qty_per_sku}
                                    data-testid={`inline-qty-${i.id}`}
                                    disabled={readOnly}
                                    onBlur={e => saveLineField(i, "qty_per_sku", e.target.value)}
                                    className="inline-input"
                                  />
                                </td>
                                <td className="num p-0">
                                  <input
                                    type="number" step="0.01" defaultValue={i.cost_per_unit}
                                    data-testid={`inline-cost-${i.id}`}
                                    disabled={readOnly}
                                    onBlur={e => saveLineField(i, "cost_per_unit", e.target.value)}
                                    className="inline-input"
                                  />
                                </td>
                                <td className="num">{inr((i.qty_per_sku || 0) * (i.cost_per_unit || 0))}</td>
                                <td className="text-right">
                                  {!readOnly && (
                                    <button onClick={() => delOne(i.id)} data-testid={`delete-line-${i.id}`}
                                      className="text-[#B83A3A] hover:bg-[#F9E5E5] p-1 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#E6E2DC] w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E2DC]">
              <div>
                <h2 className="font-display font-semibold text-lg">{editingSku ? `Edit Recipe: ${editingSku}` : "Add New Recipe"}</h2>
                <p className="text-[12px] text-[#8A8178] mt-0.5">One menu item, many ingredients</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-[#8A8178] hover:text-[#2D2824]" data-testid="form-close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submit} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
                {/* Menu Item Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Menu Item Name</label>
                    <input data-testid="form-sku" required value={form.sku_menu_item}
                      onChange={e => setForm({ ...form, sku_menu_item: e.target.value })}
                      placeholder="e.g. Veg Grilled Sandwich"
                      className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Category</label>
                    <select data-testid="form-category" value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] bg-white">
                      {SKU_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Selling Price (₹)</label>
                    <input data-testid="form-price" type="number" step="0.01" value={form.selling_price}
                      onChange={e => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15" />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="text-[11px] text-[#8A8178] tracking-widest uppercase mb-1">Margin</div>
                    <div className={`font-display text-lg font-bold ${margin < 0 ? "text-[#B83A3A]" : "text-[#4C6B56]"}`}>
                      {inr(margin)}
                    </div>
                  </div>
                </div>

                {/* Ingredients Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-display font-semibold text-[15px] text-[#2D2824]">Ingredients</div>
                      <div className="text-[12px] text-[#8A8178]">Add every ingredient this dish uses</div>
                    </div>
                    <div className="text-[12px] text-[#5B544D]">Total cost: <span className="font-medium">{inr(totalCost)}</span></div>
                  </div>

                  <div className="border border-[#E6E2DC] rounded-md overflow-hidden">
                    <table className="roots-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "36%" }}>Ingredient</th>
                          <th style={{ width: "18%" }}>Unit</th>
                          <th className="num" style={{ width: "18%" }}>Qty per SKU</th>
                          <th className="num" style={{ width: "20%" }}>Cost / Unit (₹)</th>
                          <th style={{ width: "8%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.ingredients.map((line, idx) => (
                          <tr key={idx} data-testid={`ing-line-${idx}`}>
                            <td className="p-0">
                              <input required={idx === 0} value={line.ingredient}
                                data-testid={`ing-line-name-${idx}`}
                                onChange={e => setLine(idx, { ingredient: e.target.value })}
                                placeholder="e.g. Iceberg Lettuce"
                                className="w-full px-3 py-2 border-none focus:outline-none text-[13px] bg-transparent focus:bg-white" />
                            </td>
                            <td className="p-0">
                              <input value={line.unit}
                                data-testid={`ing-line-unit-${idx}`}
                                onChange={e => setLine(idx, { unit: e.target.value })}
                                className="w-full px-3 py-2 border-none focus:outline-none text-[13px] bg-transparent focus:bg-white" />
                            </td>
                            <td className="p-0">
                              <input type="number" step="0.01" value={line.qty_per_sku}
                                data-testid={`ing-line-qty-${idx}`}
                                onChange={e => setLine(idx, { qty_per_sku: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border-none focus:outline-none text-[13px] text-right bg-transparent focus:bg-white font-mono" />
                            </td>
                            <td className="p-0">
                              <input type="number" step="0.01" value={line.cost_per_unit}
                                data-testid={`ing-line-cost-${idx}`}
                                onChange={e => setLine(idx, { cost_per_unit: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border-none focus:outline-none text-[13px] text-right bg-transparent focus:bg-white font-mono" />
                            </td>
                            <td className="text-center">
                              {form.ingredients.length > 1 && (
                                <button type="button" onClick={() => removeLine(idx)}
                                  data-testid={`ing-line-remove-${idx}`}
                                  className="text-[#B83A3A] hover:bg-[#F9E5E5] p-1 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button type="button" onClick={addLine}
                    data-testid="add-ingredient-line"
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[#A44200] text-[#A44200] text-[13px] rounded-md hover:bg-[#FDF2E3]">
                    <Plus className="w-3.5 h-3.5" /> Add ingredient
                  </button>
                </div>

                {editingSku && (
                  <div className="text-[12px] text-[#8A8178] bg-[#F1EFEB] border border-[#E6E2DC] rounded px-3 py-2">
                    Saving will replace all existing ingredients for <span className="font-medium">{editingSku}</span>.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#E6E2DC] bg-[#FAF9F7] sticky bottom-0">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-[13px] border border-[#E6E2DC] rounded-md hover:bg-white">
                  Cancel
                </button>
                <button type="submit" data-testid="form-submit" className="px-4 py-2 text-[13px] bg-[#A44200] hover:bg-[#823400] text-white rounded-md">
                  {editingSku ? "Update Recipe" : "Add Recipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-white border border-[#E6E2DC] rounded-md p-4">
      <div className="text-[11px] font-medium text-[#8A8178] tracking-widest uppercase">{label}</div>
      <div className="font-display text-2xl font-bold tracking-tight text-[#2D2824] mt-1">{value}</div>
    </div>
  );
}
