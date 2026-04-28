import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

function syncLocalUserId(session) {
  try {
    const userId = session?.user?.id || "";
    if (userId) {
      localStorage.setItem("q_user_id", userId);
    } else {
      localStorage.removeItem("q_user_id");
    }
  } catch (error) {
    console.warn("Unable to access localStorage for q_user_id sync.", error);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      try {
        setLoading(true);
        setAuthError("");

        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Supabase getSession error:", error);
          setAuthError(error.message || "Failed to restore session.");
        }

        const nextSession = data?.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        syncLocalUserId(nextSession);
      } catch (error) {
        if (!mounted) return;
        console.error("Session bootstrap failed:", error);
        setAuthError(error?.message || "Failed to restore session.");
        setSession(null);
        setUser(null);
        syncLocalUserId(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrapSession();

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      syncLocalUserId(nextSession ?? null);
      setAuthError("");
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscriptionData?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      authError,

      login: async (email, password) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(email),
            password,
          });
          return { data, error };
        } catch (error) {
          return { data: null, error };
        }
      },

      signup: async (email, password) => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: normalizeEmail(email),
            password,
          });

          const needsEmailConfirmation =
            !error && !!data?.user && !data?.session;

          return { data, error, needsEmailConfirmation };
        } catch (error) {
          return {
            data: null,
            error,
            needsEmailConfirmation: false,
          };
        }
      },

      logout: async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (!error) {
            syncLocalUserId(null);
          }
          return { error };
        } catch (error) {
          return { error };
        }
      },
    }),
    [user, session, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}