import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ORDER_CYCLES } from "@/lib/helpers";
import { ChevronDown } from "lucide-react";

export default function CycleSelector({ value, onChange, label = "Cycle", testId = "cycle-selector" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        data-testid={testId}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#E6E2DC] rounded-md bg-white text-[13px] text-[#2D2824] hover:border-[#A44200]"
      >
        <span className="text-[#8A8178]">{label}:</span>
        <span className="font-medium">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#8A8178]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#E6E2DC] rounded-md shadow-md py-1 w-32 max-h-64 overflow-y-auto">
            {ORDER_CYCLES.map(c => (
              <button
                key={c}
                data-testid={`cycle-opt-${c}`}
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#F6F1EA] ${
                  c === value ? "bg-[#F1EFEB] font-medium" : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
