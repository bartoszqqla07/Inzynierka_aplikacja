import { useEffect, useMemo, useRef, useState } from "react";
import SalonCard from "../components/SalonCard";
import { isDemoMode } from "../config/demoMode";
import { getDemoReviews, getDemoSalons } from "../demo/demoApi";

const API = "http://localhost:5000";

export default function Home() {
  const [search, setSearch] = useState("");
  const [salons, setSalons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedReviews, setExpandedReviews] = useState({});
  const sliderRef = useRef(null);

  useEffect(() => {
    async function loadSalons() {
      try {
        setError("");
        setLoading(true);
        // Demo mode reads salons from src/demo instead of the backend API.
        const data = isDemoMode
          ? await getDemoSalons()
          : await (async () => {
              const res = await fetch(`${API}/salons`);
              if (!res.ok) throw new Error("Blad pobierania salonow");
              return res.json();
            })();
        const mapped = data.map((salon) => ({
          ...salon,
          services: (salon.services || []).map((srv) => srv.name),
        }));
        setSalons(mapped);

        if (isDemoMode) {
          setReviews(await getDemoReviews());
        } else {
          const reviewsRes = await fetch(`${API}/reviews`);
          if (reviewsRes.ok) {
            const reviewsData = await reviewsRes.json();
            setReviews(reviewsData);
          }
        }
      } catch {
        setError("Nie udalo sie pobrac salonow.");
      } finally {
        setLoading(false);
      }
    }

    loadSalons();
  }, []);

  const filteredSalons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return salons;
    return salons.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.services.some((srv) => srv.toLowerCase().includes(q))
    );
  }, [salons, search]);

  const stats = useMemo(() => {
    const totalSalons = salons.length;
    const totalServices = salons.reduce((sum, salon) => sum + salon.services.length, 0);
    const cities = new Set(salons.map((salon) => salon.city)).size;
    return [
      { label: "Salony", value: totalSalons },
      { label: "Uslugi", value: totalServices },
      { label: "Miasta", value: cities },
    ];
  }, [salons]);

  const testimonials = reviews;
  const testimonialsRef = useRef(null);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/60 p-8 shadow-sm backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-200 via-slate-200 to-teal-100" />
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Znajdz salon i zarezerwuj termin
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Wyszukuj po nazwie salonu, miescie lub usludze. Potem przejdz do
            listy uslug i zrob rezerwacje.
          </p>

          <div className="mt-6">
            <div className="flex w-full justify-center">
              <div className="flex w-full max-w-xl items-center rounded-2xl border-2 border-teal-300/70 bg-white/80 px-3 py-2 shadow-sm ring-2 ring-teal-200/70">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj: np. manicure, brwi, Warszawa..."
                  className="w-full bg-transparent px-2 py-2 text-center text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Tip: wpisz nazwe uslugi, np. "strzyzenie" albo miasto.
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/40 bg-white/40 p-4 shadow-sm backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-200 via-slate-200 to-teal-100" />
        <div className="mb-3 text-center">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Salony</h2>
            <p className="mt-1 text-sm text-slate-600">
              Polecane miejsca i uslugi w twojej okolicy.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center text-slate-600 shadow-sm backdrop-blur">
            Ladowanie salonow...
          </div>
        ) : error ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : filteredSalons.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center text-slate-600 shadow-sm backdrop-blur">
            Brak wynikow. Sprobuj innej frazy.
          </div>
        ) : (
          <div className="group relative">
            <button
              type="button"
              aria-label="Poprzednie salony"
              onClick={() => sliderRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Nastepne salony"
              onClick={() => sliderRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
            >
              ›
            </button>
            <div className="mx-auto max-w-5xl px-10">
              <div className="flex justify-center">
                <div
                  ref={sliderRef}
                  className="flex max-w-[56rem] gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth [scrollbar-width:thin] snap-x snap-mandatory"
                >
                {filteredSalons.map((salon) => (
                  <div key={salon.id} className="snap-center">
                    <SalonCard salon={salon} />
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-200 via-slate-200 to-teal-100" />
        <div className="grid gap-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Statystyki platformy
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              Rozwijamy sie razem z Twoimi rezerwacjami
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Aktualne dane o salonach i uslugach dostepnych w systemie.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200/70 bg-teal-50/70 px-3 py-1 text-xs font-semibold text-teal-700">
              {isDemoMode ? "Tryb demo" : "Aktualizacja na zywo"}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-3xl font-semibold text-slate-900">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-200 via-slate-200 to-teal-100" />
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Opinie klientow
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">
            Co mowia uzytkownicy?
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Prawdziwe osoby, realne wrazenia z rezerwacji.
          </p>
        </div>

        <div className="group relative mt-6">
          <button
            type="button"
            aria-label="Poprzednie opinie"
            onClick={() =>
              testimonialsRef.current?.scrollBy({ left: -360, behavior: "smooth" })
            }
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Nastepne opinie"
            onClick={() =>
              testimonialsRef.current?.scrollBy({ left: 360, behavior: "smooth" })
            }
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
          >
            ›
          </button>
          <div
            ref={testimonialsRef}
            className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth [scrollbar-width:thin] snap-x snap-mandatory px-8"
          >
            {testimonials.length === 0 ? (
              <div className="w-full rounded-2xl border border-slate-200/60 bg-white/80 p-5 text-center text-sm text-slate-600">
                Brak opinii. Badz pierwsza osoba, ktora doda opinie!
              </div>
            ) : testimonials.map((item) => {
              const isExpanded = Boolean(expandedReviews[item.id]);
              const isLong = String(item.text || "").length > 160;
              return (
                <div key={item.id} className="snap-start">
                  <div
                    className={`relative w-80 shrink-0 rounded-2xl border border-slate-200/80 bg-white/90 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md flex flex-col ${
                      isExpanded ? "h-auto min-h-[18rem]" : "h-[18rem]"
                    }`}
                  >
                  <div className="text-3xl leading-none text-teal-300">“</div>
                  <div className="mt-3 flex items-center gap-1 text-base text-amber-400">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span
                        key={`${item.name}-${item.city}-star-${index}`}
                        className={index < item.rating ? "text-amber-400" : "text-slate-200"}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p
                    className={`mt-2 text-sm text-slate-700 transition ${
                      isExpanded ? "max-h-none" : "max-h-[6rem] overflow-hidden"
                    }`}
                  >
                    {item.text}
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedReviews((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                    >
                      {isExpanded ? "Zwin ^" : "Rozwin v"}
                    </button>
                  )}
                  <div className="mt-auto pt-4 text-sm font-semibold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500">{item.city}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
