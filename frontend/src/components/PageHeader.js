export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="border-b border-[#E6E2DC] bg-white/60 backdrop-blur px-8 py-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-[#2D2824]">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#8A8178] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
