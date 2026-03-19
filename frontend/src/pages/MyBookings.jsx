import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ConfirmDialog from "../components/ConfirmDialog";

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

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPastBooking(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

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

export default function MyBookings() {
  const [session, setSession] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [salons, setSalons] = useState([]);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [editBookings, setEditBookings] = useState([]);
  const [editBookingsLoading, setEditBookingsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isEditDateTimeOpen, setIsEditDateTimeOpen] = useState(false);
  const [editCalendarMonth, setEditCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editDraft, setEditDraft] = useState({
    salonId: "",
    serviceId: "",
    date: "",
    time: "",
    clientName: "",
    clientPhone: "",
  });

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
    async function loadBookings() {
      if (!session) {
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        setError("");
        setLoading(true);
        const res = await fetch(`${API}/me/bookings`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error("Blad pobierania rezerwacji");
        const data = await res.json();
        setBookings(data);
      } catch {
        setError("Nie udalo sie pobrac rezerwacji.");
      } finally {
        setLoading(false);
      }
    }

    loadBookings();
  }, [session]);

  useEffect(() => {
    async function loadSalons() {
      if (!session) return;
      try {
        const res = await fetch(`${API}/salons`);
        if (!res.ok) throw new Error("Blad pobierania salonow");
        const data = await res.json();
        setSalons(data);
      } catch {
        setSalons([]);
      }
    }

    loadSalons();
  }, [session]);

  function toLocalDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toLocalTimeInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function loadServices(salonId) {
    if (!salonId) {
      setServices([]);
      return;
    }
    setServicesLoading(true);
    try {
      const res = await fetch(`${API}/salons/${salonId}/services`);
      if (!res.ok) throw new Error("Blad pobierania uslug");
      const data = await res.json();
      setServices(data);
    } catch {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }

  async function loadEditBookings(salonId) {
    if (!salonId) {
      setEditBookings([]);
      return;
    }
    setEditBookingsLoading(true);
    try {
      const res = await fetch(`${API}/bookings?salonId=${salonId}`);
      if (!res.ok) throw new Error("Blad pobierania rezerwacji");
      const data = await res.json();
      setEditBookings(data);
    } catch {
      setEditBookings([]);
    } finally {
      setEditBookingsLoading(false);
    }
  }

  function startEdit(booking) {
    const salonId = booking.salonId || booking.salon?.id || "";
    const serviceId = booking.serviceId || booking.service?.id || "";
    setEditingId(booking.id);
    setEditDraft({
      salonId: salonId ? String(salonId) : "",
      serviceId: serviceId ? String(serviceId) : "",
      date: toLocalDateInput(booking.dateTime),
      time: toLocalTimeInput(booking.dateTime),
      clientName: booking.clientName || "",
      clientPhone: booking.clientPhone || "",
    });
    loadServices(salonId);
    loadEditBookings(salonId);
    const parsedDate = new Date(booking.dateTime);
    if (!Number.isNaN(parsedDate.getTime())) {
      setEditCalendarMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
    }
    setIsEditDateTimeOpen(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({
      salonId: "",
      serviceId: "",
      date: "",
      time: "",
      clientName: "",
      clientPhone: "",
    });
    setIsEditDateTimeOpen(false);
  }

  async function saveEdit(bookingId) {
    if (!session) return;
    setError("");
    setInfoMsg("");
    if (!editDraft.salonId || !editDraft.serviceId || !editDraft.date || !editDraft.time) {
      setError("Uzupelnij salon, usluge oraz termin.");
      return;
    }
    if (!editDraft.clientName.trim()) {
      setError("Imie jest wymagane.");
      return;
    }

    const payload = {
      salonId: Number(editDraft.salonId),
      serviceId: Number(editDraft.serviceId),
      clientName: editDraft.clientName.trim(),
      clientPhone: editDraft.clientPhone ? editDraft.clientPhone.trim() : null,
      dateTime: `${editDraft.date}T${editDraft.time}:00`,
    };

    try {
      const res = await fetch(`${API}/me/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        const msg = details?.error || "Blad aktualizacji rezerwacji.";
        throw new Error(msg);
      }
      setInfoMsg("Zapisano zmiany rezerwacji.");
      setEditingId(null);
      const refreshed = await fetch(`${API}/me/bookings`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setBookings(data);
      }
    } catch (err) {
      setError(err?.message || "Blad aktualizacji rezerwacji.");
    }
  }

  async function cancelBooking(bookingId) {
    if (!session) return;
    setError("");
    setInfoMsg("");
    try {
      const res = await fetch(`${API}/me/bookings/${bookingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        const msg = details?.error || "Blad anulowania rezerwacji.";
        throw new Error(msg);
      }
      setInfoMsg("Wizyta zostala odwolana.");
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      setError(err?.message || "Blad anulowania rezerwacji.");
    }
  }

  async function confirmAndRun() {
    if (!confirmDialog) return;
    const action = confirmDialog.action;
    const bookingId = confirmDialog.bookingId;
    setConfirmDialog(null);
    if (action === "cancel") {
      await cancelBooking(bookingId);
    }
  }

  const editSalon = useMemo(() => {
    const sid = Number(editDraft.salonId);
    if (!sid) return null;
    return salons.find((salon) => salon.id === sid) || null;
  }, [editDraft.salonId, salons]);

  const openDays = useMemo(
    () => parseOpenDays(editSalon?.hours || ""),
    [editSalon?.hours]
  );

  const { editBlockedTimes, editVisibleTimes } = useMemo(() => {
    if (!editDraft.date) {
      return { editBlockedTimes: new Set(), editVisibleTimes: TIME_OPTIONS };
    }

    const sid = Number(editDraft.serviceId);
    const selectedService = services.find((s) => s.id === sid);
    const hasService = Boolean(selectedService);
    const selectedDuration = selectedService?.duration ?? 0;

    const now = new Date();
    const selectedDate = new Date(`${editDraft.date}T00:00:00`);
    const { ranges, known } = getDayRanges(editSalon?.hours, selectedDate);

    const bookingWindows = hasService
      ? editBookings
          .filter((b) => b.serviceId === sid && b.id !== editingId)
          .map((b) => {
            const start = new Date(b.dateTime);
            if (formatLocalDate(start) !== editDraft.date) return null;
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

      const candidateStart = toLocalDateTime(editDraft.date, time);
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

    return { editBlockedTimes: blocked, editVisibleTimes: visible };
  }, [editBookings, editDraft.date, editDraft.serviceId, services, editSalon?.hours, editingId]);

  useEffect(() => {
    if (!editDraft.date) return;
    const parsed = new Date(`${editDraft.date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setEditCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [editDraft.date]);

  const visibleBookings = useMemo(
    () => bookings.filter((booking) => !isPastBooking(booking.dateTime)),
    [bookings]
  );

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Moje rezerwacje</h1>
          <p className="mt-2 text-slate-600">
            Zaloguj sie, aby zobaczyc swoje rezerwacje.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Zaloguj sie
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Moje rezerwacje</h1>
          <p className="mt-1 text-base text-slate-600">
            Lista przyszlych wizyt przypisanych do Twojego konta.
          </p>
      </div>

      {error && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-base text-red-700 shadow-sm">
          {error}
        </div>
      )}
      {infoMsg && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-base text-emerald-700 shadow-sm">
          {infoMsg}
        </div>
      )}

      {loading ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center text-base text-slate-600 shadow-sm backdrop-blur">
          Ladowanie rezerwacji...
        </div>
      ) : visibleBookings.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center text-base text-slate-600 shadow-sm backdrop-blur">
          Brak przyszlych rezerwacji. Zarezerwuj termin z listy salonow.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleBookings.map((booking) => {
            const isEditing = editingId === booking.id;
            return (
            <div
              key={booking.id}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-semibold text-slate-800">
                  {formatDateTime(booking.dateTime)}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-teal-700"
                  >
                    {booking.service?.duration ? `${booking.service.duration} min` : "Wizyta"}
                  </span>
                </div>
              </div>

              <div className="mt-3 text-xl font-semibold text-slate-900">
                {booking.service?.name || "Usluga"}
              </div>

              <div className="mt-2 grid gap-2 text-base text-slate-600">
                <div>
                  <span className="text-slate-400">Salon:</span>{" "}
                  {booking.salon?.name || "Brak danych"}
                </div>
                <div>
                  <span className="text-slate-400">Adres:</span>{" "}
                  {booking.salon?.city ? `${booking.salon.city}, ` : ""}
                  {booking.salon?.address || "Brak danych"}
                </div>
              </div>

              <div className="mt-3 text-base text-slate-700">
                <span className="text-slate-400">Imie:</span> {booking.clientName}
                {booking.clientPhone ? ` - Tel: ${booking.clientPhone}` : ""}
              </div>

              {isEditing ? (
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1 text-xs text-slate-500">
                      Salon
                      <select
                        value={editDraft.salonId}
                        onChange={(e) => {
                          const nextSalonId = e.target.value;
                          setEditDraft((prev) => ({
                            ...prev,
                            salonId: nextSalonId,
                            serviceId: "",
                            date: "",
                            time: "",
                          }));
                          loadServices(nextSalonId);
                          loadEditBookings(nextSalonId);
                        }}
                        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                      >
                        <option value="">Wybierz salon</option>
                        {salons.map((salon) => (
                          <option key={salon.id} value={salon.id}>
                            {salon.name} ({salon.city})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid min-w-0 gap-1 text-xs text-slate-500">
                      Usluga
                      <select
                        value={editDraft.serviceId}
                        onChange={(e) =>
                          setEditDraft((prev) => ({
                            ...prev,
                            serviceId: e.target.value,
                            time: "",
                          }))
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                        disabled={!editDraft.salonId || servicesLoading}
                      >
                        <option value="">
                          {servicesLoading ? "Ladowanie uslug..." : "Wybierz usluge"}
                        </option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} ({service.duration} min)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-2 text-center">
                    <span className="text-xs text-slate-500">Termin</span>
                    <div
                      className="relative"
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsEditDateTimeOpen((open) => !open)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsEditDateTimeOpen((open) => !open);
                        }
                      }}
                    >
                      <button
                        type="button"
                        aria-expanded={isEditDateTimeOpen}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/50 px-3 py-2 text-sm outline-none transition hover:border-slate-400 hover:bg-white/70"
                      >
                        <span className="flex-1 text-center text-slate-700">
                          {editDraft.date
                            ? `${formatDisplayDate(editDraft.date)}${
                              editDraft.time ? ` - ${editDraft.time}` : " - wybierz godzine"
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

                      {isEditDateTimeOpen && (
                        <div
                          className="mt-2 rounded-2xl border border-slate-200/60 bg-white/60 p-3 shadow-lg backdrop-blur"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Data</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditCalendarMonth(
                                      new Date(
                                        editCalendarMonth.getFullYear(),
                                        editCalendarMonth.getMonth() - 1,
                                        1
                                      )
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
                                >
                                  &lt;
                                </button>
                                <span className="text-xs font-semibold text-slate-700">
                                  {editCalendarMonth.toLocaleDateString("pl-PL", {
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditCalendarMonth(
                                      new Date(
                                        editCalendarMonth.getFullYear(),
                                        editCalendarMonth.getMonth() + 1,
                                        1
                                      )
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
                                >
                                  &gt;
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
                              {["Pn", "Wt", "Sr", "Cz", "Pt", "Sb", "Nd"].map((label) => (
                                <div key={label} className="text-center font-semibold">
                                  {label}
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-2">
                              {buildCalendarDays(editCalendarMonth).map((day, index) => {
                                if (!day) {
                                  return <div key={`empty-${index}`} />;
                                }

                                const today = startOfDay(new Date());
                                const isPastDate = day < today;
                                const isClosed = openDays && !openDays.has(day.getDay());
                                const isSelected =
                                  editDraft.date &&
                                  isSameDay(day, new Date(`${editDraft.date}T00:00:00`));

                                return (
                                  <button
                                    key={day.toISOString()}
                                    type="button"
                                    disabled={isPastDate || isClosed}
                                    onClick={() => {
                                      if (isPastDate || isClosed) return;
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        date: formatLocalDate(day),
                                        time: "",
                                      }));
                                    }}
                                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                                      isSelected
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : isPastDate || isClosed
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
                            {!editDraft.date ? (
                              <span className="text-xs text-slate-500">
                                Najpierw wybierz date.
                              </span>
                            ) : (
                              <>
                                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                                  {editVisibleTimes.map((time) => (
                                    <button
                                      key={time}
                                      type="button"
                                      disabled={editBlockedTimes.has(time)}
                                      onClick={() => {
                                        if (editBlockedTimes.has(time)) return;
                                        setEditDraft((prev) => ({ ...prev, time }));
                                        setIsEditDateTimeOpen(false);
                                      }}
                                      aria-pressed={editDraft.time === time}
                                      aria-disabled={editBlockedTimes.has(time)}
                                      className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                                        editDraft.time === time
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : editBlockedTimes.has(time)
                                            ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                                            : "border-slate-200 bg-white/50 text-slate-700 hover:border-slate-400 hover:bg-white/70 hover:text-slate-900"
                                      }`}
                                    >
                                      {time}
                                    </button>
                                  ))}
                                </div>
                                {editVisibleTimes.length === 0 && (
                                  <span className="text-xs text-slate-500">
                                    Brak godzin w tym dniu (salon nieczynny).
                                  </span>
                                )}
                              </>
                            )}
                            {editBookingsLoading && (
                              <span className="text-xs text-slate-500">
                                Ladowanie zajetych terminow...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs text-slate-500">
                      Imie
                      <input
                        value={editDraft.clientName}
                        onChange={(e) =>
                          setEditDraft((prev) => ({ ...prev, clientName: e.target.value }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-slate-500">
                      Telefon
                      <input
                        value={editDraft.clientPhone}
                        onChange={(e) =>
                          setEditDraft((prev) => ({ ...prev, clientPhone: e.target.value }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(booking.id)}
                      className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
                    >
                      Zapisz zmiany
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                    >
                      Anuluj edycje
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(booking)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        action: "cancel",
                        bookingId: booking.id,
                        title: "Odwolac wizyte?",
                        message: "Czy na pewno chcesz odwolac te wizyte?",
                        confirmText: "Odwolaj",
                      })
                    }
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Odwolaj wizyte
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        cancelText="Anuluj"
        danger
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmAndRun}
      />
    </div>
  );
}
