import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = location.state?.from || "/";
  const [email, setEmail] = useState(location.state?.prefillEmail || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = email.trim().length > 0;

  const handleSendReset = async (event) => {
    event.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setInfoMsg("Wyslalismy link do resetu hasla. Sprawdz skrzynke email.");
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-teal-200/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.35),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.28),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>
      <div className="fixed inset-0 z-30 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-md" />
        <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-8">
          <Link
            to={backTo}
            aria-label="Zamknij"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            X
          </Link>
          <div className="text-xs uppercase tracking-wide text-slate-400">Reset hasla</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Przypomnienie hasla</h1>

          <form className="mt-6 grid gap-3 text-left" onSubmit={handleSendReset}>
            {errorMsg ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            ) : null}
            {infoMsg ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {infoMsg}
              </div>
            ) : null}
            <label className="grid gap-1">
              <span className="text-xs text-slate-500">Email</span>
              <input
                autoComplete="email"
                placeholder="np. jan@firma.pl"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <button
              disabled={!canSubmit || isLoading}
              className="mt-2 w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Wysylanie..." : "Wyslij link resetujacy"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/login", { state: { from: backTo } })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Wroc do logowania
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
