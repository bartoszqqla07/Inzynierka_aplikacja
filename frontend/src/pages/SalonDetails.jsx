import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API = "http://localhost:5000";

export default function SalonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [session, setSession] = useState(null);
  const galleryRef = useRef(null);
  const servicesRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadSalon() {
      try {
        setError("");
        setLoading(true);
        const res = await fetch(`${API}/salons/${id}`);
        if (!res.ok) throw new Error("Blad pobierania salonu");
        const data = await res.json();
        setSalon({
          ...data,
          services: data.services || [],
        });
      } catch {
        setError("Nie udalo sie pobrac danych salonu.");
      } finally {
        setLoading(false);
      }
    }

    loadSalon();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Ladowanie salonu</h1>
          <p className="mt-2 text-slate-600">Prosimy czekac...</p>
        </div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Nie znaleziono salonu</h1>
          <p className="mt-2 text-slate-600">
            {error || "Wroc na strone startowa."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Start
          </Link>
        </div>
      </div>
    );
  }

  const gallery = salon.images?.length
    ? salon.images
    : salon.imageUrl
      ? [{ url: salon.imageUrl }]
      : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="text-center text-sm text-slate-500">
        <Link to="/" className="hover:text-slate-700">Start</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{salon.name}</span>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/60 p-6 text-center shadow-sm backdrop-blur [box-shadow:inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-xs uppercase tracking-wide text-slate-400">O salonie</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">{salon.name}</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">{salon.city}</p>
          {salon.description && (
            <p className="mt-4 text-sm text-slate-700 sm:text-base">{salon.description}</p>
          )}
        </div>

        {authNotice && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 shadow-sm">
            {authNotice}
          </div>
        )}

        <div className="mx-auto mt-6 grid max-w-4xl gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Adres</div>
            <div className="mt-2 font-medium text-slate-900">{salon.address || "Brak danych"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Telefon</div>
            <div className="mt-2 font-medium text-slate-900">{salon.phone || "Brak danych"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Uslug</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{salon.services.length}</div>
          </div>
        </div>

      </section>

      {gallery.length > 0 && (
        <section className="rounded-3xl border border-slate-200/70 bg-white/60 p-5 shadow-sm backdrop-blur [box-shadow:inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-900">Galeria</h2>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-teal-200/70" />
          </div>

          <div className="group relative mt-4">
            <button
              type="button"
              aria-label="Poprzednie zdjecia"
              onClick={() => galleryRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
            >
              &lt;
            </button>
            <button
              type="button"
              aria-label="Nastepne zdjecia"
              onClick={() => galleryRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
            >
              &gt;
            </button>
            <div
              ref={galleryRef}
              className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth [scrollbar-width:thin] snap-x snap-mandatory px-2"
            >
              {gallery.map((img, index) => (
                <div key={`${img.url}-${index}`} className="snap-start">
                  <div className="w-72 shrink-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm">
                    <img
                      src={img.url}
                      alt={`${salon.name} ${index + 1}`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200/70 bg-white/60 p-5 shadow-sm backdrop-blur [box-shadow:inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Zabiegi / uslugi</h2>
          <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-teal-200/70" />
        </div>

        <div className="group relative mt-3">
          <button
            type="button"
            aria-label="Poprzednie uslugi"
            onClick={() => servicesRef.current?.scrollBy({ left: -360, behavior: "smooth" })}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
          >
            &lt;
          </button>
          <button
            type="button"
            aria-label="Nastepne uslugi"
            onClick={() => servicesRef.current?.scrollBy({ left: 360, behavior: "smooth" })}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 p-2 text-sm font-semibold text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-white hover:text-slate-900"
          >
            &gt;
          </button>
          <div
            ref={servicesRef}
            className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth [scrollbar-width:thin] snap-x snap-mandatory px-2"
          >
            {salon.services.map((srv) => (
              <div key={srv.id} className="snap-start">
                <div className="flex h-40 w-80 shrink-0 flex-col justify-between rounded-2xl border border-teal-200/70 bg-white/60 p-4 text-center shadow-sm backdrop-blur">
                  <div className="flex flex-col items-center">
                    <div className="text-center font-semibold text-slate-900">{srv.name}</div>
                    <div className="mt-2 rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                      {srv.duration} min - {srv.price} zl
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!session) {
                          setAuthNotice("Zaloguj sie, aby zarezerwowac termin.");
                          return;
                        }
                        navigate(`/bookings?salonId=${salon.id}`, {
                          state: { serviceId: String(srv.id), salonId: String(salon.id) },
                        });
                      }}
                      className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
                    >
                      Rezerwuj
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
