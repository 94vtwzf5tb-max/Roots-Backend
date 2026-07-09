export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg || JSON.stringify(d)).join(", ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const ORDER_CYCLES = ["O1","O2","O3","O4","O5","O6","O7","O8","O9","O10"];

export const STOCK_CATEGORIES = ["FROZEN", "DRY STOCK", "MISE-EN", "BREADS", "DIARY"];

export const SKU_CATEGORIES = [
  "Sandwich & Burgers", "Pasta", "Pizza", "Dessert", "Beverages",
  "Sides", "Salads", "Breakfast", "Mains", "Other"
];

export function inr(v) {
  if (v == null || isNaN(v)) return "₹0";
  return "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
