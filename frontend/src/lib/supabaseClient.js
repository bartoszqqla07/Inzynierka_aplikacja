import { createClient } from "@supabase/supabase-js";
import { isDemoMode } from "../config/demoMode";
import {
  buildDemoSession,
  demoLogin,
  getDemoUser,
  logoutDemoUser,
  subscribeDemoAuth,
} from "../demo/demoAuth";

function createDemoSupabaseClient() {
  return {
    auth: {
      async getSession() {
        const user = getDemoUser();
        return { data: { session: buildDemoSession(user) }, error: null };
      },
      onAuthStateChange(callback) {
        const unsubscribe = subscribeDemoAuth((user) => {
          callback(user ? "SIGNED_IN" : "SIGNED_OUT", buildDemoSession(user));
        });
        return {
          data: {
            subscription: {
              unsubscribe,
            },
          },
        };
      },
      async signInWithPassword({ email, password }) {
        try {
          const user = await demoLogin(email, password);
          return {
            data: { session: buildDemoSession(user), user },
            error: null,
          };
        } catch (error) {
          return { data: { session: null, user: null }, error };
        }
      },
      async signOut() {
        logoutDemoUser();
        return { error: null };
      },
      async signUp() {
        return { data: null, error: new Error("Rejestracja jest niedostepna w trybie demo.") };
      },
      async resetPasswordForEmail() {
        return { data: null, error: new Error("Reset hasla jest niedostepny w trybie demo.") };
      },
      async updateUser() {
        return { data: null, error: new Error("Zmiana hasla jest niedostepna w trybie demo.") };
      },
    },
  };
}

export const supabase = isDemoMode
  ? createDemoSupabaseClient()
  : createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
