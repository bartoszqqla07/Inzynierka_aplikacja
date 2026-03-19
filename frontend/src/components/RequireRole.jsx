import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function RequireRole({ roles, children }) {
  const location = useLocation();
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 text-center text-sm text-slate-600 shadow-sm">
        Ladowanie konta...
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
}
