import { useState } from "react";
import { Link } from "react-router-dom";
import { isDemoMode } from "../config/demoMode";
import { addDemoReview } from "../demo/demoApi";

export default function AddReview() {
  const [rating, setRating] = useState("5");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [text, setText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    city.trim().length > 0 &&
    text.trim().length > 0 &&
    rating;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (!canSubmit) {
      setErrorMsg("Wypelnij wszystkie pola.");
      return;
    }

    setIsLoading(true);

    try {
      if (isDemoMode) {
        await addDemoReview({
          name: name.trim(),
          city: city.trim(),
          rating: Number(rating),
          text: text.trim(),
        });
      } else {
        const res = await fetch("http://localhost:5000/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            city: city.trim(),
            rating: Number(rating),
            text: text.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data?.error || "Nie udalo sie zapisac opinii.");
          return;
        }
      }

      setName("");
      setCity("");
      setText("");
      setRating("5");
      setInfoMsg("Dziekujemy! Opinia zostala dodana.");
    } catch {
      setErrorMsg(isDemoMode ? "Nie udalo sie zapisac opinii demo." : "Blad polaczenia z backendem.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-3xl border border-slate-200/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-900">Dodaj opinie</h1>
        <p className="mt-2 text-sm text-slate-600">
          Podziel sie wrazeniami z rezerwacji.
        </p>

        <form className="mt-6 grid gap-4 text-left" onSubmit={handleSubmit}>
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
            <span className="text-xs text-slate-500">Twoje imie</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="np. Anna K."
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Miasto</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="np. Warszawa"
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Ocena</span>
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            >
              <option value="5">5 - rewelacja</option>
              <option value="4">4 - bardzo dobrze</option>
              <option value="3">3 - ok</option>
              <option value="2">2 - slabo</option>
              <option value="1">1 - zle</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Opinia</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Napisz krotka opinie..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            />
          </label>

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
            >
              {isLoading ? "Wysylanie..." : "Wyslij opinie"}
            </button>
            <Link
              to="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Wroc
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
