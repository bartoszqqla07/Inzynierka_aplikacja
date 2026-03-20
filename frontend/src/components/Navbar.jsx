import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { isDemoMode } from "../config/demoMode";
import {
  deleteDemoNotification,
  getDemoNotifications,
  markAllDemoNotificationsRead,
  markDemoNotificationRead,
} from "../demo/demoApi";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const API = "http://localhost:5000";

const baseClasses =
  "rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-500 sm:text-sm";
const activeClasses = "ring-2 ring-teal-200";
const inactiveClasses = "";

function NavItem({ to, label, end, state }) {
  return (
    <NavLink
      to={to}
      end={end}
      state={state}
      className={({ isActive }) =>
        `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const { session, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const userMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const desktopMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (isDemoMode) {
      if (!user?.id) return;
      setIsNotificationsLoading(true);
      setNotificationsError("");
      try {
        const data = await getDemoNotifications(user.id, 20);
        setNotifications(Array.isArray(data.items) ? data.items : []);
        setUnreadCount(Number(data.unreadCount) || 0);
      } catch (err) {
        setNotificationsError(err?.message || "Nie udalo sie pobrac powiadomien.");
      } finally {
        setIsNotificationsLoading(false);
      }
      return;
    }
    if (!session?.access_token) return;
    setIsNotificationsLoading(true);
    setNotificationsError("");
    try {
      const res = await fetch(`${API}/notifications?limit=20`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Notifications fetch failed");
      }
      const data = await res.json();
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (err) {
      setNotificationsError(err?.message || "Nie udalo sie pobrac powiadomien.");
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [session?.access_token]);

  const markNotificationRead = async (id) => {
    if (isDemoMode) {
      await markDemoNotificationRead(id);
      await fetchNotifications();
      return;
    }
    if (!session?.access_token) return;

    const target = notifications.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const res = await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Notification read failed");
    } catch {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, isRead: false } : item))
      );
      setUnreadCount((current) => current + 1);
    }
  };

  const markAllNotificationsRead = async () => {
    if (isDemoMode) {
      if (!user?.id || unreadCount === 0) return;
      await markAllDemoNotificationsRead(user.id);
      await fetchNotifications();
      return;
    }
    if (!session?.access_token || unreadCount === 0) return;

    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await fetch(`${API}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Notification read-all failed");
    } catch {
      await fetchNotifications();
    }
  };

  const deleteNotification = async (id) => {
    if (isDemoMode) {
      await deleteDemoNotification(id);
      await fetchNotifications();
      return;
    }
    if (!session?.access_token) return;

    const target = notifications.find((item) => item.id === id);
    if (!target) return;

    setNotifications((current) => current.filter((item) => item.id !== id));
    if (!target.isRead) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    try {
      const res = await fetch(`${API}/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Notification delete failed");
    } catch {
      await fetchNotifications();
    }
  };

  function formatNotificationDate(value) {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
  };

  useEffect(() => {
    if ((isDemoMode && !user?.id) || (!isDemoMode && !session?.access_token)) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
      setIsNotificationsOpen(false);
      return;
    }

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, isDemoMode ? 30000 : 15000);
    return () => clearInterval(intervalId);
  }, [fetchNotifications, isDemoMode, session?.access_token, user?.id]);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    if ((isDemoMode && !user?.id) || (!isDemoMode && !session?.access_token)) return;
    fetchNotifications();
  }, [fetchNotifications, isDemoMode, isNotificationsOpen, session?.access_token, user?.id]);

  useEffect(() => {
    if (isDemoMode) return undefined;
    if (!session?.access_token) return undefined;

    const streamUrl = `${API}/notifications/stream?token=${encodeURIComponent(session.access_token)}`;
    const source = new EventSource(streamUrl);

    source.addEventListener("ready", () => {
      fetchNotifications();
    });
    source.addEventListener("notification", () => {
      fetchNotifications();
    });

    return () => {
      source.close();
    };
  }, [session?.access_token, fetchNotifications]);

  useEffect(() => {
    closeAllMenus();
  }, [location.pathname, location.search]);

  const userLabel = session?.user?.email || "Uzytkownik";
  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.role === "OWNER" || user?.role === "ADMIN";
  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setIsDesktopMenuOpen(false);
    setIsOpen(false);
    setIsNotificationsOpen(false);
  };
  const handleMobileNavigate = (to, options = {}) => {
    closeAllMenus();
    navigate(to, options);
  };

  return (
    <nav className="flex shrink-0 items-center justify-end gap-2 lg:w-auto">
      <div className="relative lg:hidden" ref={mobileMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsMenuOpen((value) => !value);
            setIsDesktopMenuOpen(false);
            setIsOpen(false);
            setIsNotificationsOpen(false);
          }}
          className="relative rounded-xl border border-slate-200 bg-white/85 p-2.5 text-slate-700 shadow-sm transition hover:bg-white"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Otworz menu"
        >
          {unreadCount > 0 && session ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>

        {isMenuOpen ? (
          <>
            <button
              type="button"
              aria-label="Zamknij menu"
              className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px]"
              onClick={closeAllMenus}
            />
            <div
              className="fixed right-3 top-[4.5rem] z-40 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
              role="menu"
            >
              <div className="max-h-[75vh] overflow-y-auto p-2">
                {isDemoMode ? (
                  <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                    Tryb DEMO
                  </div>
                ) : null}

                {session ? (
                  <>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Konto
                      </div>
                      <div className="mt-1 break-all text-sm font-semibold text-slate-900">
                        {userLabel}
                      </div>
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsNotificationsOpen((value) => !value)}
                        className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-slate-800"
                      >
                        <span>Powiadomienia</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {unreadCount}
                        </span>
                      </button>

                      {isNotificationsOpen ? (
                        <div className="border-t border-slate-200 bg-slate-50">
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="text-xs font-semibold text-slate-500">
                              Ostatnie
                            </div>
                            <button
                              type="button"
                              onClick={markAllNotificationsRead}
                              className="text-[11px] font-semibold text-teal-700 disabled:text-slate-300"
                              disabled={unreadCount === 0}
                            >
                              Oznacz wszystkie
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {isNotificationsLoading ? (
                              <div className="px-3 py-3 text-sm text-slate-500">Ladowanie...</div>
                            ) : notificationsError ? (
                              <div className="px-3 py-3 text-sm text-rose-600">{notificationsError}</div>
                            ) : notifications.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-slate-500">Brak powiadomien.</div>
                            ) : (
                              notifications.map((item) => (
                                <div
                                  key={item.id}
                                  className={`border-t border-slate-200 px-3 py-3 ${
                                    item.isRead ? "bg-white" : "bg-teal-50/70"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => markNotificationRead(item.id)}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <div
                                        className={`text-sm text-slate-900 ${
                                          item.isRead ? "font-medium" : "font-bold"
                                        }`}
                                      >
                                        {item.title}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-600">{item.message}</div>
                                      <div className="mt-2 text-[11px] text-slate-400">
                                        {formatNotificationDate(item.createdAt)}
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteNotification(item.id)}
                                      className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                      aria-label="Usun powiadomienie"
                                    >
                                      x
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 grid gap-1">
                      <button
                        type="button"
                        className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => handleMobileNavigate("/my-bookings")}
                      >
                        Moje rezerwacje
                      </button>
                      <button
                        type="button"
                        className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => handleMobileNavigate("/add-review")}
                      >
                        Dodaj opinie
                      </button>
                      {isAdmin ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => handleMobileNavigate("/schedule")}
                          >
                            Terminarz
                          </button>
                          <button
                            type="button"
                            className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => handleMobileNavigate("/admin")}
                          >
                            Panel admina
                          </button>
                        </>
                      ) : null}
                      {isOwner && !isAdmin ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => handleMobileNavigate("/schedule")}
                          >
                            Terminarz
                          </button>
                          <button
                            type="button"
                            className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            onClick={() => handleMobileNavigate("/owner")}
                          >
                            Panel wlasciciela
                          </button>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          closeAllMenus();
                          await handleLogout();
                        }}
                        className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Wyloguj
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => handleMobileNavigate("/login", { state: { from } })}
                  >
                    Zaloguj sie
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <div className="relative" ref={desktopMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsDesktopMenuOpen((value) => !value);
              setIsMenuOpen(false);
              setIsOpen(false);
              setIsNotificationsOpen(false);
            }}
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white sm:text-sm"
            aria-expanded={isDesktopMenuOpen}
            aria-haspopup="menu"
          >
            Menu
          </button>
          {isDesktopMenuOpen ? (
            <div
              className="absolute right-0 z-[70] mt-2 w-[15rem] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
              role="menu"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                role="menuitem"
                onClick={() => handleMobileNavigate("/add-review")}
              >
                Dodaj opinie
              </button>
              {isAdmin && (
                <>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                    onClick={() => handleMobileNavigate("/schedule")}
                  >
                    Terminarz
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                    onClick={() => handleMobileNavigate("/admin")}
                  >
                    Panel admina
                  </button>
                </>
              )}
              {isOwner && !isAdmin && (
                <>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                    onClick={() => handleMobileNavigate("/schedule")}
                  >
                    Terminarz
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                    onClick={() => handleMobileNavigate("/owner")}
                  >
                    Panel wlasciciela
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
        {isDemoMode ? (
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-700 sm:px-3 sm:text-xs">
            DEMO
          </span>
        ) : null}
        {session ? (
          <>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                className={`${baseClasses} max-w-[min(220px,60vw)] truncate`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
              >
                {userLabel}
              </button>
              {isOpen ? (
                <div
                  className="absolute right-0 z-30 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
                  role="menu"
                >
                  <div className="px-4 py-2 text-xs uppercase tracking-wide text-slate-400">
                    Zalogowano jako
                  </div>
                  <div className="px-4 pb-2 text-sm text-slate-900 break-all">
                    {userLabel}
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  <Link
                    to="/my-bookings"
                    className="block px-4 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                  >
                    Moje rezerwacje
                  </Link>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    role="menuitem"
                  >
                    Wyloguj
                  </button>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((value) => !value)}
                className="relative rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-700 shadow-sm transition hover:bg-white"
                aria-expanded={isNotificationsOpen}
                aria-haspopup="menu"
                aria-label="Powiadomienia"
              >
                <span className="pointer-events-none" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h11z" />
                    <path d="M9 17a3 3 0 0 0 6 0" />
                  </svg>
                </span>
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {isNotificationsOpen ? (
                <div
                  className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
                  role="menu"
                >
                  <div className="flex items-center justify-between px-4 pb-2">
                    <div className="text-sm font-semibold text-slate-900">Powiadomienia</div>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-semibold text-teal-700 transition hover:text-teal-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      disabled={unreadCount === 0}
                    >
                      Oznacz wszystkie
                    </button>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  <div className="max-h-80 overflow-auto">
                    {isNotificationsLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Ladowanie...</div>
                    ) : notificationsError ? (
                      <div className="px-4 py-3 text-sm text-rose-600">{notificationsError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Brak powiadomien.</div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`relative block w-full border-l-4 px-4 py-3 text-left transition hover:bg-slate-50 ${
                            item.isRead
                              ? "border-l-transparent bg-white"
                              : "border-l-teal-500 bg-teal-100/70"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => deleteNotification(item.id)}
                            className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-xs font-bold text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            aria-label="Usun powiadomienie"
                          >
                            x
                          </button>
                          {!item.isRead ? (
                            <span className="absolute right-10 top-3 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Nowe
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => markNotificationRead(item.id)}
                            className="block w-full text-left"
                          >
                            <div
                              className={`text-sm text-slate-900 ${
                                item.isRead ? "font-medium" : "font-bold"
                              }`}
                            >
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">{item.message}</div>
                            <div className="mt-2 text-[11px] text-slate-400">
                              {formatNotificationDate(item.createdAt)}
                            </div>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <NavItem to="/login" label="Zaloguj sie" state={{ from }} />
        )}
      </div>
    </nav>
  );
}
