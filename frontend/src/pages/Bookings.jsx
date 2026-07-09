import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isDemoMode } from "../config/demoMode";
import {
  createDemoBooking,
  getDemoBookingsBySalon,
  getDemoSalonById,
  getDemoServices,
} from "../demo/demoApi";
import { getDemoUser } from "../demo/demoAuth";
import { supabase } from "../lib/supabaseClient";

const API = "http://localhost:5000";
const TIME_OPTIONS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
];
const DAY_ORDER = [
  { key: "mon", day: 1 },
  { key: "tue", day: 2 },
  { key: "wed", day: 3 },
  { key: "thu", day: 4 },
  { key: "fri", day: 5 },
  { key: "sat", day: 6 },
  { key: "sun", day: 0 },
];
const DAY_KEY_BY_INDEX = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export default function Bookings() {
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [bookingSalonId, setBookingSalonId] = useState("");
  const [bookingSalon, setBookingSalon] = useState(null);
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [isDateTimeOpen, setIsDateTimeOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [session, setSession] = useState(null);

  const location = useLocation();

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
    const salonId =
      new URLSearchParams(location.search).get("salonId") || location.state?.salonId || "";
    if (salonId) setBookingSalonId(String(salonId));
    if (location.state?.serviceId) {
      setBookingServiceId(String(location.state.serviceId));
    }
  }, [location.search, location.state]);

  useEffect(() => {
    async function loadSalon() {
      if (!bookingSalonId) {
        setBookingSalon(null);
        return;
      }
      try {
        const data = isDemoMode
          ? await getDemoSalonById(bookingSalonId)
          : await (async () => {
              const res = await fetch(`${API}/salons/${bookingSalonId}`);
              if (!res.ok) throw new Error("Blad pobierania salonu");
              return res.json();
            })();
        setBookingSalon(data);
      } catch {
        setBookingSalon(null);
      }
    }

    loadSalon();
  }, [bookingSalonId]);

  async function loadServices() {
    if (!bookingSalonId) {
      setServices([]);
      setError("Wybierz salon, aby zobaczyc jego uslugi.");
      return;
    }

    try {
      setError("");
      const data = isDemoMode
        ? await getDemoServices(bookingSalonId)
        : await (async () => {
            const res = await fetch(`${API}/salons/${bookingSalonId}/services`);
            if (!res.ok) throw new Error("Blad pobierania uslug");
            return res.json();
          })();
      setServices(data);
    } catch {
      setError("Nie udalo sie pobrac uslug. Upewnij sie, ze backend dziala na :5000.");
    }
  }

  async function loadBookings() {
    if (!bookingSalonId) return;
    try {
      setBookingsLoading(true);
      const data = isDemoMode
        ? await getDemoBookingsBySalon(bookingSalonId)
        : await (async () => {
            const res = await fetch(`${API}/bookings?salonId=${bookingSalonId}`);
            if (!res.ok) throw new Error("Blad pobierania rezerwacji");
            return res.json();
          })();
      setBookings(data);
    } catch {
      setError("Nie udalo sie pobrac rezerwacji.");
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
    loadBookings();
  }, [bookingSalonId]);

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function toLocalDateTime(dateString, timeString) {
    if (!dateString || !timeString) return null;
    const dt = new Date(`${dateString}T${timeString}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function buildCalendarDays(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function parseOpenDays(hoursValue) {
    if (!hoursValue) return null;
    if (typeof hoursValue === "object") {
      const openDays = new Set();
      DAY_ORDER.forEach(({ key, day }) => {
        const slots = hoursValue[key];
        if (Array.isArray(slots) && slots.length > 0) {
          openDays.add(day);
        }
      });
      return openDays;
    }
    if (typeof hoursValue !== "string") return null;
    const dayMap = {
      pon: 1,
      wt: 2,
      sr: 3,
      cz: 4,
      pt: 5,
      sob: 6,
      nd: 0,
      niedz: 0,
    };
    const openDays = new Set();
    const parts = hoursValue
      .toLowerCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const dayPart = part.split(" ")[0];
      if (!dayPart) return;
      if (dayPart.includes("-")) {
        const [startRaw, endRaw] = dayPart.split("-").map((item) => item.trim());
        const start = dayMap[startRaw];
        const end = dayMap[endRaw];
        if (start == null || end == null) return;
        let day = start;
        while (true) {
          openDays.add(day);
          if (day === end) break;
          day = (day + 1) % 7;
        }
      } else {
        const day = dayMap[dayPart];
        if (day != null) openDays.add(day);
      }
    });

    return openDays;
  }

  function timeToMinutes(value) {
    const [h, m] = String(value).split(":").map((part) => Number(part));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function getDayRanges(hoursValue, date) {
    if (!hoursValue || typeof hoursValue !== "object") return { ranges: [], known: false };
    const key = DAY_KEY_BY_INDEX[date.getDay()];
    const slots = hoursValue[key];
    if (!Array.isArray(slots)) return { ranges: [], known: false };
    const ranges = slots
      .map((slot) => {
        const start = timeToMinutes(slot?.from);
        const end = timeToMinutes(slot?.to);
        if (start == null || end == null) return null;
        return { start, end };
      })
      .filter(Boolean);
    return { ranges, known: true };
  }

  const { blockedTimes, visibleTimes } = useMemo(() => {
    if (!bookingDate) {
      return { blockedTimes: new Set(), visibleTimes: TIME_OPTIONS };
    }

    const sid = Number(bookingServiceId);
    const selectedService = services.find((s) => s.id === sid);
    const hasService = Boolean(selectedService);
    const selectedDuration = selectedService?.duration ?? 0;

    const now = new Date();
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    const { ranges, known } = getDayRanges(bookingSalon?.hours, selectedDate);

    const bookingWindows = hasService
      ? bookings
          .filter((b) => b.serviceId === sid)
          .map((b) => {
            const start = new Date(b.dateTime);
            if (formatLocalDate(start) !== bookingDate) return null;
            const duration = b.service?.duration ?? selectedDuration;
            return { start, end: addMinutes(start, duration || 0) };
          })
          .filter(Boolean)
      : [];

    const blocked = new Set();
    const visible = [];

    TIME_OPTIONS.forEach((time) => {
      const minutes = timeToMinutes(time);
      if (minutes == null) return;

      const inRange = !known
        ? true
        : ranges.some(({ start, end }) => {
            if (!hasService || !selectedDuration) {
              return minutes >= start && minutes < end;
            }
            return minutes >= start && minutes + selectedDuration <= end;
          });

      if (inRange) {
        visible.push(time);
      }

      const candidateStart = toLocalDateTime(bookingDate, time);
      if (!candidateStart) return;
      const candidateEnd = addMinutes(candidateStart, selectedDuration);
      const overlaps = hasService
        ? bookingWindows.some(
            ({ start, end }) => candidateStart >= start && candidateStart < end
          )
        : false;
      const inPast = candidateEnd <= now;

      if (!inRange || overlaps || inPast) blocked.add(time);
    });

    return { blockedTimes: blocked, visibleTimes: visible };
  }, [bookings, bookingDate, bookingServiceId, services, bookingSalon?.hours]);

  const openDays = useMemo(
    () => parseOpenDays(bookingSalon?.hours || ""),
    [bookingSalon?.hours]
  );

  useEffect(() => {
    if (!bookingDate) return;
    const parsed = new Date(`${bookingDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [bookingDate]);

  async function submitBooking(e) {
    e.preventDefault();

    try {
      setError("");
      setInfoMsg("");
      if (!session) {
        setError("Zaloguj sie, aby zarezerwowac termin.");
        return;
      }
      if (!bookingSalonId) {
        setError("Wybierz salon przed rezerwacja.");
        return;
      }
      if (blockedTimes.has(bookingTime)) {
        setError("Termin zajety lub w przeszlosci - wybierz inna godzine.");
        return;
      }

      const payload = {
        salonId: Number(bookingSalonId),
        serviceId: Number(bookingServiceId),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || null,
        dateTime: bookingDate && bookingTime ? `${bookingDate}T${bookingTime}:00` : "",
      };

      if (isDemoMode) {
        // Demo bookings are stored locally so the whole flow works without backend/database.
        const demoUser = getDemoUser();
        if (!demoUser) {
          setError("Zaloguj sie, aby zarezerwowac termin.");
          return;
        }
        await createDemoBooking({ ...payload, userId: demoUser.id });
      } else {
        const res = await fetch(`${API}/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 409) {
          setError("Termin zajety - wybierz inna godzine.");
          return;
        }

        if (!res.ok) {
          let details = "";
          try {
            const data = await res.json();
            if (data?.error) details = ` (${data.error})`;
          } catch {
            // ignore parse errors
          }
          setError(`Nie udalo sie zapisac rezerwacji.${details}`);
          return;
        }
      }

      setClientName("");
      setClientPhone("");
      setBookingDate("");
      setBookingTime("");
      await loadBookings();
      setInfoMsg("Zarezerwowano. Twoja rezerwacja zostala zapisana.");
    } catch {
      setError(
        isDemoMode ? "Nie udalo sie zapisac rezerwacji demo." : "Blad polaczenia z backendem (czy dziala :5000?)"
      );
    }
  }

  return (
    <div className="relative overflow-visible rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.12),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(135deg,rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="grid items-start gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center shadow-sm backdrop-blur sm:p-5">
        <div className="relative flex flex-wrap items-center justify-center gap-2 sm:gap-0">
          {bookingSalonId && (
            <Link
              to={`/salons/${bookingSalonId}`}
              aria-label="Powrot"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white sm:absolute sm:left-0"
            >
              &lt;
            </Link>
          )}
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Nowa rezerwacja</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Prosimy o podanie prawdziwych danych.
        </p>
        {bookingSalon && (
          <div className="mt-3 rounded-2xl border border-teal-200/60 bg-teal-50/70 p-3 text-sm text-slate-700">
            Rezerwujesz w: <span className="font-semibold">{bookingSalon.name}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}
        {infoMsg && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 shadow-sm">
            {infoMsg}
          </div>
        )}

        <form onSubmit={submitBooking} className="mt-5 grid justify-items-center gap-3 sm:gap-4">
          <label className="grid w-full max-w-sm gap-1 text-center">
            <span className="text-xs text-slate-500">Usluga</span>
            <select
              value={bookingServiceId}
              onChange={(e) => setBookingServiceId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-center text-sm outline-none transition focus:border-teal-500"
            >
              <option value="">Wybierz usluge...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration} min, {s.price} zl)
                </option>
              ))}
            </select>
          </label>

          <div className="grid w-full max-w-sm gap-2 text-center">
            <span className="text-xs text-slate-500">Termin</span>
            <div
              className="relative"
              role="button"
              tabIndex={0}
              onClick={() => setIsDateTimeOpen((open) => !open)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsDateTimeOpen((open) => !open);
                }
              }}
            >
              <button
                type="button"
                aria-expanded={isDateTimeOpen}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-sm outline-none transition hover:border-slate-400 hover:bg-white/70"
              >
                <span className="flex-1 text-center text-slate-700">
                  {bookingDate
                    ? `${formatDisplayDate(bookingDate)}${
                      bookingTime ? ` - ${bookingTime}` : " - wybierz godzine"
                    }`
                    : "Wybierz termin..."}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 3v2m8-2v2M3 9h18m-2 12H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2Z"
                  />
                </svg>
              </button>

              {isDateTimeOpen && (
                <div
                  className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-slate-200/60 bg-white/95 p-3 shadow-lg backdrop-blur"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Data</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth() - 1,
                                1
                              )
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
                        >
                          ‹
                        </button>
                        <span className="text-xs font-semibold text-slate-700">
                          {calendarMonth.toLocaleDateString("pl-PL", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth() + 1,
                                1
                              )
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-400 sm:gap-2 sm:text-xs">
                      {["Pn", "Wt", "Sr", "Cz", "Pt", "Sb", "Nd"].map((label) => (
                        <div key={label} className="text-center font-semibold">
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {buildCalendarDays(calendarMonth).map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} />;
                        }

                        const today = startOfDay(new Date());
                        const isPast = day < today;
                        const isClosed =
                          openDays && !openDays.has(day.getDay());
                        const isSelected =
                          bookingDate && isSameDay(day, new Date(`${bookingDate}T00:00:00`));

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            disabled={isPast || isClosed}
                            onClick={() => {
                              if (isPast || isClosed) return;
                              setBookingDate(formatLocalDate(day));
                              setBookingTime("");
                            }}
                            className={`rounded-lg border px-1.5 py-2 text-[11px] font-semibold transition sm:px-2 sm:text-xs ${
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : isPast || isClosed
                                  ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                                  : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-400 hover:bg-white"
                            }`}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <span className="text-xs text-slate-500">Godzina</span>
                    {!bookingDate ? (
                      <span className="text-xs text-slate-500">
                        Najpierw wybierz date.
                      </span>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                          {visibleTimes.map((time) => (
                            <button
                              key={time}
                              type="button"
                              disabled={blockedTimes.has(time)}
                              onClick={() => {
                                if (blockedTimes.has(time)) return;
                                setBookingTime(time);
                                setIsDateTimeOpen(false);
                              }}
                              aria-pressed={bookingTime === time}
                              aria-disabled={blockedTimes.has(time)}
                              className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition sm:text-xs ${
                                bookingTime === time
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : blockedTimes.has(time)
                                    ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                                    : "border-slate-200 bg-white/50 text-slate-700 hover:border-slate-400 hover:bg-white/70 hover:text-slate-900"
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                        {visibleTimes.length === 0 && (
                          <span className="text-xs text-slate-500">
                            Brak godzin w tym dniu (salon nieczynny).
                          </span>
                        )}
                      </>
                    )}
                    {bookingsLoading && (
                      <span className="text-xs text-slate-500">
                        Ladowanie zajetych terminow...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className="grid w-full max-w-sm gap-1 text-center">
            <span className="text-xs text-slate-500">Imie klienta</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-center text-sm outline-none transition focus:border-teal-500"
            placeholder="np. Jan"
          />
          </label>

          <label className="grid w-full max-w-sm gap-1 text-center">
            <span className="text-xs text-slate-500">Telefon (opcjonalnie)</span>
          <input
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-center text-sm outline-none transition focus:border-teal-500"
            placeholder="np. 500 600 700"
          />
          </label>

          <button
            disabled={
              !session ||
              !bookingSalonId ||
              !bookingServiceId ||
              !bookingDate ||
              !bookingTime ||
              !clientName
            }
            className="mt-2 w-full max-w-sm rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-40"
          >
            Zarezerwuj
          </button>
        </form>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center shadow-sm backdrop-blur lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold text-slate-900">Podpowiedz</h2>
        <p className="mt-2 text-sm text-slate-600">
          Kliknij Rezerwuj na karcie uslugi - automatycznie wybierze ja w formularzu.
        </p>
      </aside>
      </div>
    </div>
  );
}
