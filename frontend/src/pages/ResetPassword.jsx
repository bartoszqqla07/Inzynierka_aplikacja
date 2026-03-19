import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit =
    !!session &&
    !isLoading &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsCheckingSession(false);

      if (event === "PASSWORD_RECOVERY") {
        setInfoMsg("Mozesz teraz ustawic nowe haslo.");
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (event) => {
    event.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Hasla nie sa takie same.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Haslo musi miec co najmniej 6 znakow.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setInfoMsg("Haslo zostalo zmienione. Mozesz sie zalogowac.");
    setPassword("");
    setConfirmPassword("");
  };

  const showInvalidLinkState = !isCheckingSession && !session;

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
            to="/"
            aria-label="Zamknij"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            X
          </Link>
          <div className="text-xs uppercase tracking-wide text-slate-400">Nowe haslo</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Ustaw nowe haslo</h1>

          <form className="mt-6 grid gap-3 text-left" onSubmit={handleReset}>
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

            {showInvalidLinkState ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Link do resetu jest niepoprawny albo wygasl. Popros o nowy link.
              </div>
            ) : null}

            <label className="grid gap-1">
              <span className="text-xs text-slate-500">Nowe haslo</span>
              <input
                autoComplete="new-password"
                placeholder="********"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-slate-500">Powtorz haslo</span>
              <input
                autoComplete="new-password"
                placeholder="********"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              />
            </label>
            <button
              disabled={!canSubmit}
              className="mt-2 w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Zapisywanie..." : "Zmien haslo"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Wyslij nowy link resetujacy
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Przejdz do logowania
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
