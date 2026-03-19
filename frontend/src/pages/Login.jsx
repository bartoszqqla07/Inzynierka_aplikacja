import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isDemoMode } from "../config/demoMode";
import { supabase } from "../lib/supabaseClient";

const demoAccounts = [
  { label: "USER", email: "user@test.pl", password: "123456" },
  { label: "OWNER", email: "owner@test.pl", password: "123456" },
  { label: "ADMIN", email: "admin@test.pl", password: "123456" },
];

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = location.state?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  const loginWithCredentials = async (nextEmail, nextPassword) => {
    setErrorMsg("");
    setInfoMsg("");
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: nextEmail.trim(),
      password: nextPassword,
    });

    setIsLoading(false);

    if (error) {
      setErrorMsg("Niepoprawny email/haslo");
      return false;
    }

    navigate(backTo, { replace: true });
    return true;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    await loginWithCredentials(email, password);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-teal-200/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.35),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.28),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>
      <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto px-4 py-6">
        <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-md" />
        <div className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-8">
          <Link
            to={backTo}
            aria-label="Zamknij"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            X
          </Link>
          <div className="text-xs uppercase tracking-wide text-slate-400">Logowanie</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Zaloguj sie</h1>

          <form className="mt-6 grid gap-3 text-left" onSubmit={handleLogin}>
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
            <label className="grid gap-1">
              <span className="text-xs text-slate-500">Haslo</span>
              <input
                autoComplete="current-password"
                placeholder="********"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <button
              disabled={!canSubmit || isLoading}
              className="mt-2 w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Logowanie..." : "Zaloguj"}
            </button>
            {!isDemoMode && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/forgot-password", {
                      state: { from: backTo, prefillEmail: email.trim() },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Nie pamietam hasla
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/register", { state: { from: backTo } })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Nie mam konta
                </button>
              </>
            )}
          </form>

          {isDemoMode && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left shadow-sm">
              <div className="text-xs uppercase tracking-wide text-amber-700">Tryb demo</div>
              <p className="mt-2 text-sm text-amber-900">
                Uzyj jednego z gotowych kont albo kliknij szybkie logowanie.
              </p>
              <div className="mt-3 grid gap-2 text-xs text-amber-900">
                {demoAccounts.map((account) => (
                  <div
                    key={account.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2"
                  >
                    <span>{account.email} / {account.password}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                        loginWithCredentials(account.email, account.password);
                      }}
                      className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 sm:w-auto"
                    >
                      Zaloguj jako {account.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

