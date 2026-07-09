import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/helpers";
import { Wheat } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@roots.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#F9F8F6]">
      <div className="flex flex-col justify-center px-8 md:px-16 py-12">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-10 h-10 rounded-md bg-[#A44200] flex items-center justify-center">
              <Wheat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-[#2D2824]">ROOTS</div>
              <div className="text-[10px] text-[#8A8178] tracking-widest uppercase">Ambala City</div>
            </div>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-[#2D2824] mb-2">
            Welcome back.
          </h1>
          <p className="text-[14px] text-[#5B544D] mb-8">
            Sign in to plan orders, track receiving, and monitor cycle health.
          </p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5B544D] mb-1.5 uppercase tracking-wide">Password</label>
              <input
                data-testid="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-[#E6E2DC] rounded-md text-[14px] focus:outline-none focus:border-[#A44200] focus:ring-2 focus:ring-[#A44200]/15"
              />
            </div>
            {error && <div data-testid="login-error" className="text-[13px] text-[#B83A3A] bg-[#F9E5E5] px-3 py-2 rounded-md">{error}</div>}
            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#A44200] hover:bg-[#823400] disabled:opacity-60 text-white text-[14px] font-medium rounded-md transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-[13px] text-[#8A8178]">
            No account? <Link to="/register" data-testid="link-register" className="text-[#A44200] hover:underline font-medium">Create one</Link>
          </div>

          <div className="mt-10 text-[11px] text-[#8A8178] border-t border-[#E6E2DC] pt-4">
            Default admin: <span className="font-mono">admin@roots.com / admin123</span>
          </div>
        </div>
      </div>

      <div
        className="hidden md:block relative bg-cover bg-center"
        style={{
          backgroundImage: "url(https://images.unsplash.com/photo-1466637574441-749b8f19452f?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D2824]/70 via-[#2D2824]/30 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="text-[10px] tracking-widest uppercase opacity-80">Operations Console</div>
          <div className="font-display text-3xl font-bold mt-2 leading-tight">
            From forecast to fulfillment.<br/>Every cycle, tracked.
          </div>
        </div>
      </div>
    </div>
  );
}
