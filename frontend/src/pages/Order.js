import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import CycleSelector from "@/components/CycleSelector";
import { STOCK_CATEGORIES, inr, formatApiError } from "@/lib/helpers";
import { toast } from "sonner";
import { Save, Download, PackageCheck, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Order() {
  const [cycle, setCycle] = useState("O1");
  const { readOnly } = useAuth();
  const [rows, setRows] = useState([]);
  const [ings, setIngs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [settings, setSettings] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: o }, { data: i }] = await Promise.all([
        api.get("/settings"),
        api.get(`/order/${cycle}`),
        api.get("/ingredients"),
      ]);
      setSettings(s);
      setRows(o);
      setIngs(i);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [cycle]);

  // Set default cycle from settings once
  useEffect(() => {
    api.get("/settings").then(({ data }) => {
      if (data.current_cycle && data.current_cycle !== cycle) setCycle(data.current_cycle);
    });
  }, []);

  const updateField = (ingredient, field, value) => {
    const num = value === "" ? 0 : parseFloat(value);
    setIngs(is => is.map(i => {
      if (i.ingredient !== ingredient) return i;
      return { ...i, [field]: { ...(i[field] || {}), [cycle]: isNaN(num) ? 0 : num } };
    }));
    setDirty(d => ({ ...d, [ingredient]: true }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toSave = ings.filter(i => dirty[i.ingredient]);
      await Promise.all(toSave.map(i => api.put(`/ingredients/${i.id}`, i)));
      setDirty({});
      toast.success(`Saved ${toSave.length} update${toSave.length !== 1 ? "s" : ""}`);
      const { data } = await api.get(`/order/${cycle}`);
      setRows(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const exportCsv = () => {
    const headers = ["Category","Ingredient","Unit","Required","Inventory","Wastage","To Order","Rounded","Order Value","Delivered","Received","Variance"];
    const lines = [headers.join(",")];
    rows.forEach(r => {
      lines.push([
        r.stock_category, r.ingredient, r.unit,
        r.required, r.inventory, r.wastage, r.to_order, r.rounded_qty,
        r.order_value, r.delivered, r.received, r.variance
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `roots-order-${cycle}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

    // Header
    doc.setFillColor(164, 66, 0);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ROOTS · Ambala City", 40, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Order to be Packed", 40, 48);
    doc.setFontSize(10);
    doc.text(`Cycle: ${cycle}${settings?.cycle_dates?.[cycle] ? " · " + new Date(settings.cycle_dates[cycle]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}`, pageWidth - 40, 30, { align: "right" });
    doc.text(now, pageWidth - 40, 48, { align: "right" });

    // Summary
    doc.setTextColor(45, 40, 36);
    doc.setFontSize(9);
    doc.text(`Items to Order: ${totalItems}  |  Total Value: ${inr(totalValue)}  |  Categories: ${grouped.length}`, 40, 82);

    // Signatures / meta
    let startY = 100;

    grouped.forEach(g => {
      const catTotal = g.items.reduce((s, i) => s + i.order_value, 0);
      autoTable(doc, {
        startY,
        head: [[
          { content: `${g.category}  ·  ${g.items.length} items  ·  ${inr(catTotal)}`, colSpan: 9,
            styles: { fillColor: [241, 239, 235], textColor: [45, 40, 36], fontStyle: "bold", halign: "left", fontSize: 10 } }
        ], [
          "Ingredient", "Unit", "To Order", "Rounded", "Order Value", "Delivered\n(Cantt)", "Received\n(City)", "Variance", "Notes"
        ]],
        body: g.items.map(r => [
          r.ingredient, r.unit, String(r.to_order), String(r.rounded_qty),
          inr(r.order_value),
          r.delivered ? String(r.delivered) : "____",
          r.received ? String(r.received) : "____",
          r.variance ? String(r.variance) : "",
          "",
        ]),
        theme: "grid",
        headStyles: { fillColor: [230, 226, 220], textColor: [91, 84, 77], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [45, 40, 36] },
        alternateRowStyles: { fillColor: [250, 249, 247] },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 45 },
          2: { cellWidth: 55, halign: "right" },
          3: { cellWidth: 55, halign: "right" },
          4: { cellWidth: 75, halign: "right" },
          5: { cellWidth: 65, halign: "right" },
          6: { cellWidth: 65, halign: "right" },
          7: { cellWidth: 55, halign: "right" },
          8: { cellWidth: "auto" },
        },
        margin: { left: 40, right: 40 },
      });
      startY = doc.lastAutoTable.finalY + 14;
    });

    // Footer signatures
    if (startY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      startY = 40;
    }
    doc.setDrawColor(230, 226, 220);
    doc.line(60, startY + 40, 240, startY + 40);
    doc.line(pageWidth - 240, startY + 40, pageWidth - 60, startY + 40);
    doc.setFontSize(9);
    doc.setTextColor(138, 129, 120);
    doc.text("Cantt Outlet (Packed by)", 60, startY + 55);
    doc.text("City Outlet (Received by)", pageWidth - 240, startY + 55);

    doc.save(`roots-order-${cycle}.pdf`);
    toast.success("PDF downloaded");
  };

  const hasDirty = Object.keys(dirty).length > 0;
  const grouped = STOCK_CATEGORIES.map(cat => ({
    category: cat,
    items: rows.filter(r => r.stock_category === cat),
  })).filter(g => g.items.length > 0);

  // Add uncategorized items
  const knownCats = new Set(STOCK_CATEGORIES);
  const others = rows.filter(r => !knownCats.has(r.stock_category));
  if (others.length > 0) grouped.push({ category: "OTHER", items: others });

  const totalItems = rows.filter(r => r.to_order > 0).length;
  const totalValue = rows.reduce((s, r) => s + r.order_value, 0);
  const alertPct = (settings?.order_value_alert_pct || 0.5) * 100;

  return (
    <div>
      <PageHeader
        title="Order to be Packed"
        subtitle={
          `Consolidated order list for cycle ${cycle}` +
          (settings?.cycle_dates?.[cycle] ? ` (${new Date(settings.cycle_dates[cycle]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })})` : "") +
          " · Cantt outlet packs, City outlet receives"
        }
      >
        <CycleSelector value={cycle} onChange={setCycle} label="Cycle" testId="order-cycle-selector" />
        {hasDirty && <div className="text-[12px] text-[#D97B29]">Unsaved</div>}
        <button data-testid="save-order-btn" disabled={!hasDirty || saving || readOnly} onClick={saveAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-50 text-white text-[13px] rounded-md">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
        <button data-testid="export-csv-btn" onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E6E2DC] hover:bg-[#F6F1EA] text-[#5B544D] text-[13px] rounded-md">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
        <button data-testid="export-pdf-btn" onClick={exportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#A44200] text-[#A44200] hover:bg-[#FDF2E3] text-[13px] rounded-md">
          <FileText className="w-3.5 h-3.5" /> PDF
        </button>
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryTile label="Items to Order" value={totalItems} tone="default" />
          <SummaryTile label={`Total Order Value (${cycle})`} value={inr(totalValue)}
            tone={totalValue > 0 && alertPct > 0 ? "warning" : "default"} />
          <SummaryTile label="Categories" value={grouped.length} />
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#8A8178]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-[#E6E2DC] rounded-md p-12 text-center">
            <PackageCheck className="w-10 h-10 text-[#8A8178] mx-auto mb-3" />
            <div className="font-display text-lg text-[#2D2824] mb-1">Nothing to order yet</div>
            <div className="text-[13px] text-[#8A8178]">Add recipes & enter forecast to generate the order list.</div>
          </div>
        ) : grouped.map(g => (
          <div key={g.category} className="bg-white border border-[#E6E2DC] rounded-md overflow-hidden">
            <button
              onClick={() => setCollapsed(c => ({ ...c, [g.category]: !c[g.category] }))}
              className="w-full flex items-center justify-between px-5 py-3 bg-[#F1EFEB] border-b border-[#E6E2DC]"
              data-testid={`toggle-${g.category}`}
            >
              <div className="flex items-center gap-2">
                {collapsed[g.category] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="font-display font-semibold text-[15px] text-[#2D2824]">{g.category}</span>
                <span className="pill bg-white text-[#5B544D] border border-[#E6E2DC]">{g.items.length} items</span>
              </div>
              <span className="text-[12px] text-[#5B544D]">
                {inr(g.items.reduce((s, i) => s + i.order_value, 0))}
              </span>
            </button>
            {!collapsed[g.category] && (
              <div className="overflow-x-auto">
                <table className="roots-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Unit</th>
                      <th className="num">Required</th>
                      <th className="num">Inv</th>
                      <th className="num">Wastage</th>
                      <th className="num">To Order</th>
                      <th className="num">Rounded</th>
                      <th className="num">Order Value</th>
                      <th className="num">Delivered (Cantt)</th>
                      <th className="num">Received (City)</th>
                      <th className="num">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(r => (
                      <tr key={r.id} data-testid={`order-row-${r.id}`}>
                        <td className="font-medium">{r.ingredient}</td>
                        <td className="text-[#8A8178]">{r.unit}</td>
                        <td className="num text-[#5B544D]">{r.required}</td>
                        <td className="num text-[#5B544D]">{r.inventory}</td>
                        <td className="num text-[#5B544D]">{r.wastage}</td>
                        <td className="num font-medium text-[#A44200]">{r.to_order}</td>
                        <td className="num font-medium">{r.rounded_qty}</td>
                        <td className="num">{inr(r.order_value)}</td>
                        <td className="num p-0">
                          <input
                            data-testid={`delivered-${r.id}`}
                            type="number"
                            className="inline-input"
                            defaultValue={r.delivered || ""}
                            onChange={e => updateField(r.ingredient, "delivered", e.target.value)}
                          />
                        </td>
                        <td className="num p-0">
                          <input
                            data-testid={`received-${r.id}`}
                            type="number"
                            className="inline-input"
                            defaultValue={r.received || ""}
                            onChange={e => updateField(r.ingredient, "received", e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <VarianceBadge v={r.variance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  const bg = tone === "warning" ? "bg-[#FDF2E3] border-[#D97B29]/30" : "bg-white border-[#E6E2DC]";
  return (
    <div className={`border rounded-md p-5 ${bg}`}>
      <div className="text-[11px] font-medium text-[#8A8178] tracking-widest uppercase">{label}</div>
      <div className="font-display text-2xl font-bold tracking-tight text-[#2D2824] mt-1">{value}</div>
    </div>
  );
}

function VarianceBadge({ v }) {
  if (!v || Math.abs(v) < 0.01) return <span className="text-[#8A8178]">0</span>;
  const tone = v > 0 ? "text-[#4C6B56]" : "text-[#B83A3A]";
  return <span className={`font-medium ${tone}`}>{v > 0 ? "+" : ""}{v}</span>;
}
