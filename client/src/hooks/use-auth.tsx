// client/src/hooks/use-auth.tsx
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { supabase } from "@/lib/supabaseClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: (SelectUser & { id: string }) | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<any, Error, { email: string; password: string }>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<any, Error, { email: string; password: string }>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<SelectUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Read current user on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      setIsLoading(true);
      try {
        const {
          data: { user: supaUser }
        } = await supabase.auth.getUser();

        if (!mounted) return;
        if (supaUser) {
          // minimal mapping: supaUser has id and email; you can fetch extra public.users fields if needed
          setUser({ id: supaUser.id, email: supaUser.email ?? undefined } as any);
        } else {
          setUser(null);
        }
      } catch (err: any) {
        setError(err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();

    // subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({ id: u.id, email: u.email ?? undefined } as any);
        // optionally refetch queries that depend on auth
        queryClient.invalidateQueries(["/api/user"]);
      } else {
        setUser(null);
        queryClient.setQueryData(["/api/user"], null);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  // login via Supabase client
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const u = data.session?.user ?? data.user;
      if (u) setUser({ id: u.id, email: u.email ?? undefined } as any);
      toast({ title: "Welcome back!", description: "You have been logged in." });
    },
    onError: (e: Error) => {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    },
  });

  // register via Supabase client (sends email)
  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Account created", description: "Check your email to confirm your account." });
    },
    onError: (e: Error) => {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.setQueryData(["/api/user"], null);
      toast({ title: "Logged out", description: "You have been logged out." });
    },
    onError: (e: Error) => {
      toast({ title: "Logout failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
