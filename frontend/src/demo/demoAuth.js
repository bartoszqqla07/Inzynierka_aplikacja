import { demoUsers } from "./demoData";
import { sanitizeDemoUser } from "./demoUtils";

const DEMO_AUTH_KEY = "bookme.demo.auth.user";
const DEMO_AUTH_EVENT = "bookme:demo-auth-changed";

export function buildDemoSession(user) {
  if (!user) return null;
  return {
    access_token: `demo-token-${user.id}`,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

function emitDemoAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEMO_AUTH_EVENT));
}

export function getDemoUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEMO_AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isDemoAuthenticated() {
  return Boolean(getDemoUser());
}

export async function demoLogin(email, password) {
  const user = demoUsers.find(
    (item) => item.email.toLowerCase() === String(email).trim().toLowerCase()
  );

  if (!user || user.password !== password) {
    throw new Error("Niepoprawny email/haslo");
  }

  const safeUser = sanitizeDemoUser(user);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(safeUser));
    emitDemoAuthChange();
  }
  return safeUser;
}

export function logoutDemoUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_AUTH_KEY);
  emitDemoAuthChange();
}

export function subscribeDemoAuth(callback) {
  if (typeof window === "undefined") return () => {};

  const handleCustom = () => {
    callback(getDemoUser());
  };
  const handleStorage = (event) => {
    if (event.key && event.key !== DEMO_AUTH_KEY) return;
    callback(getDemoUser());
  };

  window.addEventListener(DEMO_AUTH_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(DEMO_AUTH_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}
