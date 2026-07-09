import Sidebar from "./Sidebar";
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Eye, LogIn } from "lucide-react";

function ReadOnlyBanner() {
  const { readOnly } = useAuth();
  if (!readOnly) return null;
  return (
    <div className="bg-[#FDF2E3] border-b border-[#D97B29]/30 px-6 py-2 flex items-center justify-between text-[12px]">
      <div className="flex items-center gap-2 text-[#5B544D]">
        <Eye className="w-3.5 h-3.5 text-[#A44200]" />
        <span><span className="font-medium text-[#2D2824]">Read-only preview</span> — you&apos;re viewing this workbook as a guest. Sign in to add recipes, save inventory, or record receiving.</span>
      </div>
      <Link
        to="/login"
        data-testid="banner-login-btn"
        className="flex items-center gap-1.5 px-3 py-1 bg-[#A44200] hover:bg-[#823400] text-white text-[12px] font-medium rounded-md"
      >
        <LogIn className="w-3 h-3" /> Sign in
      </Link>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-[#F9F8F6]">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <ReadOnlyBanner />
        <Outlet />
      </main>
    </div>
  );
}
