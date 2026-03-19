import { demoBookings, demoReviews, demoSalons, demoUsers } from "./demoData";

const DEMO_STATE_KEY = "bookme.demo.state";
const DEMO_STATE_EVENT = "bookme:demo-state-changed";

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function delay(ms = 120) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildInitialState() {
  const salons = deepClone(demoSalons);
  const bookings = deepClone(demoBookings);
  const reviews = deepClone(demoReviews);
  const users = deepClone(demoUsers);
  return {
    salons,
    bookings,
    reviews,
    users,
    counters: {
      salon: Math.max(...salons.map((item) => item.id), 100) + 1,
      service: Math.max(...salons.flatMap((item) => item.services.map((service) => service.id)), 200) + 1,
      image: Math.max(...salons.flatMap((item) => item.images.map((image) => image.id)), 1000) + 1,
      booking: Math.max(...bookings.map((item) => item.id), 400) + 1,
      review: Math.max(...reviews.map((item) => item.id), 300) + 1,
    },
  };
}

export function ensureDemoState() {
  if (typeof window === "undefined") {
    return buildInitialState();
  }

  const raw = window.localStorage.getItem(DEMO_STATE_KEY);
  if (!raw) {
    const initialState = buildInitialState();
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(initialState));
    return initialState;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const initialState = buildInitialState();
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(initialState));
    return initialState;
  }
}

export function getDemoState() {
  return deepClone(ensureDemoState());
}

export function setDemoState(nextState) {
  if (typeof window === "undefined") return deepClone(nextState);
  window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent(DEMO_STATE_EVENT, { detail: deepClone(nextState) }));
  return deepClone(nextState);
}

export function updateDemoState(updater) {
  const current = ensureDemoState();
  const next = updater(deepClone(current));
  return setDemoState(next);
}

export function subscribeDemoState(callback) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event) => {
    if (event.key && event.key !== DEMO_STATE_KEY) return;
    callback(getDemoState());
  };
  const handleCustom = () => {
    callback(getDemoState());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(DEMO_STATE_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DEMO_STATE_EVENT, handleCustom);
  };
}

export function nextCounterValue(state, key) {
  const value = state.counters[key];
  state.counters[key] += 1;
  return value;
}

export function sanitizeDemoUser(user) {
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function attachSalonRelations(salon) {
  return {
    ...salon,
    imageUrl: salon.imageUrl || salon.image || salon.images?.[0]?.url || "",
  };
}

export function attachBookingRelations(state, booking) {
  const salon = state.salons.find((item) => item.id === booking.salonId);
  const service = salon?.services.find((item) => item.id === booking.serviceId) || null;
  const user = state.users.find((item) => item.id === booking.userId) || null;
  return {
    ...booking,
    salon: salon ? attachSalonRelations(salon) : null,
    service,
    user: sanitizeDemoUser(user),
  };
}

export function monthLabel(date) {
  return date.toLocaleDateString("pl-PL", { month: "short", year: "numeric" });
}
