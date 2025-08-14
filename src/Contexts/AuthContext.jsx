// src/Contexts/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false); // prevent overlapping profile fetches
  const currentUserIdRef = useRef(null); // avoid race when user changes quickly
  const mountedRef = useRef(true);

  // Fetch role from profiles table for the given user id
  const fetchRole = async (userId) => {
    if (!userId || fetchingRef.current) return;
    try {
      fetchingRef.current = true;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) {
        // It's fine if no row yet (new user); just keep role null
        if (error.code !== "PGRST116") {
          console.error("[Auth] Error fetching role:", error);
        }
        if (!mountedRef.current) return;
        setRole(null);
        return;
      }
      if (!mountedRef.current) return;
      setRole(data?.role ?? null);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    const id = currentUserIdRef.current;
    if (id) await fetchRole(id);
  };

  // Initial session + role
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("[Auth] getSession error:", error);
      const sessionUser = data?.session?.user ?? null;

      if (!mountedRef.current) return;
      setUser(sessionUser);
      currentUserIdRef.current = sessionUser?.id ?? null;
      setRole(null); // reset; will fetch if user exists

      if (sessionUser?.id) {
        await fetchRole(sessionUser.id);
      }
      if (mountedRef.current) setLoading(false);
    })();

    // Subscribe to auth changes (signed in/out, token refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      currentUserIdRef.current = nextUser?.id ?? null;
      setUser(nextUser);
      setRole(null); // reset on every auth change; re-fetch follows
      if (nextUser?.id) {
        // fire-and-forget; component stays responsive
        fetchRole(nextUser.id);
      }
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []); // run once

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[Auth] signOut error:", e);
    } finally {
      // ensure UI updates instantly
      currentUserIdRef.current = null;
      setUser(null);
      setRole(null);
    }
  };

  const value = useMemo(
    () => ({ user, role, loading, signOut, refreshProfile }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
