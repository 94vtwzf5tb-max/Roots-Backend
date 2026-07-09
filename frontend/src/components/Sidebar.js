import { NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, BookOpen, LineChart, Layers,
  PackageCheck, GitCompare, Settings, LogOut, Wheat, LogIn, Eye
} from "lucide-react";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, testId: "nav-overview" },
  { to: "/recipes", label: "Recipe Mapping", icon: BookOpen, testId: "nav-recipes" },
  { to: "/forecast", label: "SKU Forecast", icon: LineChart, testId: "nav-forecast" },
  { to: "/planning", label: "Cycle Planning", icon: Layers, testId: "nav-planning" },
  { to: "/order", label: "Order to be Packed", icon: PackageCheck, testId: "nav-order", primary: true },
  { to: "/variance", label: "Variance Check", icon: GitCompare, testId: "nav-variance" },
  { to: "/settings", label: "Setup", icon: Settings, testId: "nav-settings" },
];

export default function Sidebar() {
  const { user, logout, readOnly } = useAuth();
  const loc = useLocation();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-[#F1EFEB] border-r border-[#E6E2DC] flex flex-col">
      <div className="px-6 py-6 border-b border-[#E6E2DC]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-[#A44200] flex items-center justify-center">
            <Wheat className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="font-display font-bold text-[17px] tracking-tight text-[#2D2824]">ROOTS</div>
            <div className="text-[10px] text-[#8A8178] tracking-widest uppercase">Ambala City</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-semibold text-[#8A8178] tracking-widest uppercase px-3 py-2">
          Operations
        </div>
        {nav.map(item => {
          const Icon = item.icon;
          const active = loc.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors ${
                active
                  ? "bg-white text-[#2D2824] font-medium shadow-sm border border-[#E6E2DC]"
                  : "text-[#5B544D] hover:bg-white/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-[#A44200]" : "text-[#8A8178]"}`} strokeWidth={2} />
              <span>{item.label}</span>
              {item.primary && !active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A44200]" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#E6E2DC]">
        {user ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#D97B29] flex items-center justify-center text-white text-sm font-medium">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#2D2824] truncate" data-testid="sidebar-user-name">
                {user?.name}
              </div>
              <div className="text-[11px] text-[#8A8178] truncate">{user?.role}</div>
            </div>
            <button
              data-testid="logout-btn"
              onClick={logout}
              className="p-2 rounded-md hover:bg-[#F9E5E5] text-[#8A8178] hover:text-[#B83A3A] transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-1">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/60 border border-[#E6E2DC] rounded-md">
              <Eye className="w-3.5 h-3.5 text-[#8A8178]" />
              <span className="text-[11px] font-medium text-[#5B544D] tracking-wide">Read-only mode</span>
            </div>
            <Link
              to="/login"
              data-testid="sidebar-login-btn"
              className="flex items-center justify-center gap-2 px-3 py-2 bg-[#A44200] hover:bg-[#823400] text-white text-[13px] font-medium rounded-md transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in to edit
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
