import { useCallback, useEffect, useMemo, useState } from "react";
import { isDemoMode } from "../config/demoMode";
import {
  cancelDemoScheduleBooking,
  getDemoScheduleBookings,
  updateDemoScheduleBooking,
} from "../demo/demoApi";
import { useAuth } from "../lib/auth";
import ConfirmDialog from "../components/ConfirmDialog";

const API = "http://localhost:5000";
const TIME_OPTIONS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
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

function groupBySalon(bookings) {
  const map = new Map();
  bookings.forEach((booking) => {
    const salonId = booking.salon?.id ?? booking.salonId ?? "unknown";
    const label =
      booking.salon?.name
        ? `${booking.salon.name}${booking.salon.city ? ` (${booking.salon.city})` : ""}`
        : "Nieznany salon";
    if (!map.has(salonId)) {
      map.set(salonId, { id: salonId, label, items: [] });
    }
    map.get(salonId).items.push(booking);
  });
  return Array.from(map.values());
}

function toTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function toLocalDateTime(dateString, timeString) {
  if (!dateString || !timeString) return null;
  const dt = new Date(`${dateString}T${timeString}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

function isPastBooking(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

export default function Schedule() {
  const { session, user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadBookings = useCallback(async () => {
    if (!session || !user) {
      setBookings([]);
      setLoading(false);
      return;
    }
    try {
      setError("");
      setLoading(true);
      const data = isDemoMode
        ? await getDemoScheduleBookings(user.role, user.id)
        : await (async () => {
            const endpoint = user.role === "ADMIN" ? "/admin/bookings" : "/owner/bookings";
            const res = await fetch(`${API}${endpoint}`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            if (!res.ok) throw new Error("Blad pobierania rezerwacji");
            return res.json();
          })();
      setBookings(data);
    } catch {
      setError("Nie udalo sie pobrac rezerwacji.");
    } finally {
      setLoading(false);
    }
  }, [session, user]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const visibleBookings = useMemo(
    () => bookings.filter((booking) => !isPastBooking(booking.dateTime)),
    [bookings]
  );
  const grouped = useMemo(() => groupBySalon(visibleBookings), [visibleBookings]);
  const editingBooking = useMemo(
    () => visibleBookings.find((booking) => booking.id === editingId) || null,
    [visibleBookings, editingId]
  );
  const { visibleTimes, blockedTimes } = useMemo(() => {
    if (!editingBooking) {
      return { visibleTimes: TIME_OPTIONS, blockedTimes: new Set() };
    }

    const selectedDuration = editingBooking.service?.duration ?? 0;
    const selectedServiceId = editingBooking.serviceId;
    const selectedDate = new Date(editingBooking.dateTime);
    const localDate = formatLocalDate(selectedDate);
    const now = new Date();
    const { ranges, known } = getDayRanges(editingBooking.salon?.hours, selectedDate);

    const bookingWindows = bookings
      .filter((booking) => booking.serviceId === selectedServiceId && booking.id !== editingBooking.id)
      .map((booking) => {
        const start = new Date(booking.dateTime);
        if (formatLocalDate(start) !== localDate) return null;
        const duration = booking.service?.duration ?? selectedDuration;
        return { start, end: addMinutes(start, duration || 0) };
      })
      .filter(Boolean);

    const blocked = new Set();
    const visible = [];

    TIME_OPTIONS.forEach((time) => {
      const minutes = timeToMinutes(time);
      if (minutes == null) return;

      const inRange = !known
        ? true
        : ranges.some(({ start, end }) => {
            if (!selectedDuration) {
              return minutes >= start && minutes < end;
            }
            return minutes >= start && minutes + selectedDuration <= end;
          });

      if (inRange) visible.push(time);

      const candidateStart = toLocalDateTime(localDate, time);
      if (!candidateStart) return;
      const candidateEnd = addMinutes(candidateStart, selectedDuration);
      const overlaps = bookingWindows.some(
        ({ start, end }) => candidateStart >= start && candidateStart < end
      );
      const inPast = candidateEnd <= now;

      if (!inRange || overlaps || inPast) blocked.add(time);
    });

    return { visibleTimes: visible, blockedTimes: blocked };
  }, [editingBooking, bookings]);
  const selectTimes = useMemo(() => {
    if (!editTime) return visibleTimes;
    if (visibleTimes.includes(editTime)) return visibleTimes;
    return [editTime, ...visibleTimes];
  }, [editTime, visibleTimes]);

  function startEdit(booking) {
    setError("");
    setInfoMsg("");
    setEditingId(booking.id);
    setEditTime(toTimeInputValue(booking.dateTime));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTime("");
  }

  async function saveEdit(bookingId) {
    if (!session || !user) return;
    if (!editTime) {
      setError("Wybierz nowa godzine.");
      return;
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(editTime)) {
      setError("Godzina ma niepoprawny format.");
      return;
    }
    if (blockedTimes.has(editTime)) {
      setError("Ta godzina jest niedostepna. Wybierz inna.");
      return;
    }

    try {
      setError("");
      setInfoMsg("");
      setBusyId(bookingId);

      if (isDemoMode) {
        await updateDemoScheduleBooking(bookingId, editTime);
      } else {
        const endpoint =
          user.role === "ADMIN"
            ? `/admin/bookings/${bookingId}`
            : `/owner/bookings/${bookingId}`;

        const res = await fetch(`${API}${endpoint}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ time: editTime }),
        });

        if (!res.ok) {
          const details = await res.json().catch(() => ({}));
          throw new Error(details?.error || "Blad aktualizacji rezerwacji");
        }
      }

      setInfoMsg("Zmieniono termin wizyty.");
      setEditingId(null);
      setEditTime("");
      await loadBookings();
    } catch (err) {
      setError(err?.message || "Blad aktualizacji rezerwacji.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(bookingId) {
    if (!session || !user) return;

    try {
      setError("");
      setInfoMsg("");
      setBusyId(bookingId);

      if (isDemoMode) {
        await cancelDemoScheduleBooking(bookingId);
      } else {
        const endpoint =
          user.role === "ADMIN"
            ? `/admin/bookings/${bookingId}`
            : `/owner/bookings/${bookingId}`;

        const res = await fetch(`${API}${endpoint}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const details = await res.json().catch(() => ({}));
          throw new Error(details?.error || "Blad anulowania rezerwacji");
        }
      }

      setInfoMsg("Wizyta zostala odwolana.");
      await loadBookings();
    } catch (err) {
      setError(err?.message || "Blad anulowania rezerwacji.");
    } finally {
      setBusyId(null);
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Terminarz</h1>
        <p className="mt-1 text-base text-slate-600">
          Lista przyszlych wizyt podzielona na salony.
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
          Ladowanie wizyt...
        </div>
      ) : grouped.length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-center text-base text-slate-600 shadow-sm backdrop-blur">
          Brak wizyt do wyswietlenia.
        </div>
      ) : (
        <div className="grid gap-6">
          {grouped.map((group) => (
            <section
              key={group.id}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{group.label}</h2>
                <span className="rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {group.items.length} wizyt
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((booking) => (
                  (() => {
                    const isEditing = editingId === booking.id;
                    const isBusy = busyId === booking.id;

                    return (
                      <div
                        key={booking.id}
                        className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm"
                      >
                        <div className="text-base font-semibold text-slate-900">
                          {formatDateTime(booking.dateTime)}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="text-slate-400">Usluga:</span>{" "}
                          {booking.service?.name || "Usluga"}
                          {booking.service?.duration
                            ? ` (${booking.service.duration} min)`
                            : ""}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          <span className="text-slate-400">Klient:</span>{" "}
                          {booking.clientName}
                          {booking.clientPhone ? ` - ${booking.clientPhone}` : ""}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 grid gap-2">
                            <label className="grid gap-1 text-xs text-slate-500">
                              Nowa godzina
                              <select
                                value={editTime}
                                onChange={(event) => setEditTime(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                              >
                                <option value="">Wybierz godzine...</option>
                                {selectTimes.map((time) => {
                                  const unavailable = blockedTimes.has(time);
                                  return (
                                    <option key={time} value={time} disabled={unavailable}>
                                      {time}{unavailable ? " - niedostepna" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>
                            {visibleTimes.length === 0 && (
                              <div className="text-xs text-slate-500">
                                Brak dostepnych godzin w dniu tej wizyty (wg godzin pracy salonu).
                              </div>
                            )}
                            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <button
                                type="button"
                                onClick={() => saveEdit(booking.id)}
                                disabled={isBusy || !editTime || blockedTimes.has(editTime)}
                                className="w-full rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60 sm:w-auto"
                              >
                                Zapisz termin
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isBusy}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 sm:w-auto"
                              >
                                Anuluj
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => startEdit(booking)}
                              disabled={isBusy}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 sm:w-auto"
                            >
                              Edytuj godzine
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDialog({
                                  action: "cancel",
                                  bookingId: booking.id,
                                  title: "Odwolac wizyte?",
                                  message:
                                    "Po potwierdzeniu rezerwacja zostanie usunieta z terminarza.",
                                  confirmText: "Odwolaj",
                                })
                              }
                              disabled={isBusy}
                              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60 sm:w-auto"
                            >
                              Odwolaj
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        cancelText="Anuluj"
        danger
        confirmDisabled={busyId != null}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmAndRun}
      />
    </div>
  );
}
