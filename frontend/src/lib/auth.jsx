import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isDemoMode } from "../config/demoMode";
import { buildDemoSession, getDemoUser, subscribeDemoAuth } from "../demo/demoAuth";
import { supabase } from "./supabaseClient";

const API = "http://localhost:5000";

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      // In demo mode auth is driven entirely by localStorage instead of Supabase.
      const initialUser = getDemoUser();
      setSession(buildDemoSession(initialUser));
      setUser(initialUser);
      setLoading(false);
      const unsubscribe = subscribeDemoAuth((nextUser) => {
        setSession(buildDemoSession(nextUser));
        setUser(nextUser);
        setLoading(false);
      });
      return unsubscribe;
    }

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
    if (isDemoMode) return undefined;

    let isMounted = true;

    async function loadUser() {
      if (!session) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${API}/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error("Me fetch failed");
        const data = await res.json();
        if (isMounted) setUser(data);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const value = useMemo(
    () => ({ session, user, loading }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
