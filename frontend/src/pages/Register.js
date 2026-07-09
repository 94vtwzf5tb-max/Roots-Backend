import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/helpers";
import { Wheat } from "lucide-react";

const ROLES = [
  { value: "admin", label: "Admin / Owner" },
  { value: "cantt_outlet", label: "Cantt Outlet Operator" },
  { value: "city_outlet", label: "City Outlet Operator" },
  { value: "operator", label: "General Operator" },
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "operator" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(form);
      nav("/");
    } catch (err) { setError(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-md bg-[#A44200] flex items-center justify-center">
            <Wheat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-lg text-[#2D2824]">ROOTS</div>
            <div className="text-[10px] text-[#8A8178] tracking-widest uppercase">Ambala City</div>
          </div>
        </div>
        <div className="bg-white rounded-md border border-[#E6E2DC] p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#2D2824] mb-1">Create account</h1>
          <p className="text-[13px] text-[#8A8178] mb-6">Set up your operator profile.</p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Name</label>
              <input data-testid="register-name" required value={form.name} onChange={set("name")}
                className="w-full px-3 py-2.5 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Email</label>
              <input data-testid="register-email" type="email" required value={form.email} onChange={set("email")}
                className="w-full px-3 py-2.5 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Password</label>
              <input data-testid="register-password" type="password" required minLength={6} value={form.password} onChange={set("password")}
                className="w-full px-3 py-2.5 border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Role</label>
              <select data-testid="register-role" value={form.role} onChange={set("role")}
                className="w-full px-3 py-2.5 border border-[#E6E2DC] rounded-md text-[14px] bg-white focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <div data-testid="register-error" className="text-[13px] text-[#B83A3A] bg-[#F9E5E5] px-3 py-2 rounded-md">{error}</div>}
            <button data-testid="register-submit" type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-60 text-white text-[14px] font-medium rounded-md transition-colors">
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-[13px] text-[#8A8178] text-center">
            Have an account? <Link data-testid="link-login" to="/login" className="text-[#A44200] hover:underline font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
