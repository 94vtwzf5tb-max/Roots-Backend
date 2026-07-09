import { useAuth } from "@/context/AuthContext";

/**
 * "Protected" only in that it waits for auth check to finish.
 * Guests are allowed through — they get the read-only view.
 * Individual pages check `readOnly` from useAuth() to gate edit controls.
 */
export default function ProtectedRoute({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
        <div className="text-sm text-[#8A8178]">Loading…</div>
      </div>
    );
  }
  return children;
}
