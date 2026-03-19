import { attachBookingRelations, getDemoState } from "./demoUtils";

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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function timeToMinutes(value) {
  const [h, m] = String(value).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRanges(hoursValue, date) {
  if (!hoursValue || typeof hoursValue !== "object") return [];
  const key = DAY_KEY_BY_INDEX[date.getDay()];
  const slots = hoursValue[key];
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => {
      const start = timeToMinutes(slot?.from);
      const end = timeToMinutes(slot?.to);
      if (start == null || end == null) return null;
      return { start, end };
    })
    .filter(Boolean);
}

export async function getDemoSalonCalendar(salonId) {
  const state = getDemoState();
  const salon = state.salons.find((item) => item.id === Number(salonId));
  return {
    salonId: Number(salonId),
    salon,
    slots: TIME_OPTIONS,
    bookings: state.bookings
      .filter((item) => item.salonId === Number(salonId))
      .map((item) => attachBookingRelations(state, item)),
  };
}

export async function getDemoOwnerCalendar(userId) {
  const state = getDemoState();
  const ownedSalonIds = state.salons
    .filter((item) => item.ownerId === Number(userId))
    .map((item) => item.id);
  return state.bookings
    .filter((item) => ownedSalonIds.includes(item.salonId))
    .map((item) => attachBookingRelations(state, item));
}

export async function getDemoUserCalendar(userId) {
  const state = getDemoState();
  return state.bookings
    .filter((item) => item.userId === Number(userId))
    .map((item) => attachBookingRelations(state, item));
}

export async function getDemoAvailableSlots({ salonId, serviceId, date }) {
  const state = getDemoState();
  const salon = state.salons.find((item) => item.id === Number(salonId));
  const service = salon?.services.find((item) => item.id === Number(serviceId));
  if (!salon || !service || !date) return [];

  const dayDate = new Date(`${date}T00:00:00`);
  const ranges = getDayRanges(salon.hours, dayDate);
  const now = new Date();
  const busyWindows = state.bookings
    .filter((item) => item.salonId === Number(salonId))
    .map((item) => {
      const start = new Date(item.dateTime);
      if (formatLocalDate(start) !== date) return null;
      const bookedService = salon.services.find((entry) => entry.id === item.serviceId);
      return {
        start,
        end: addMinutes(start, bookedService?.duration || 0),
      };
    })
    .filter(Boolean);

  return TIME_OPTIONS.filter((time) => {
    const minutes = timeToMinutes(time);
    if (minutes == null) return false;
    const inRange = ranges.some(
      ({ start, end }) => minutes >= start && minutes + service.duration <= end
    );
    if (!inRange) return false;

    const candidateStart = new Date(`${date}T${time}:00`);
    const candidateEnd = addMinutes(candidateStart, service.duration);
    if (candidateEnd <= now) return false;

    return !busyWindows.some(
      ({ start, end }) => candidateStart >= start && candidateStart < end
    );
  });
}
