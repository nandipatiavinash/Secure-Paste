import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [autoSessionDone, setAutoSessionDone] = useState(false);
  const [hasTokenInUrl, setHasTokenInUrl] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // parse tokens from url (support fragment and query)
  function parseTokensFromUrl() {
    // many providers put tokens in hash fragment like:
    // #access_token=...&refresh_token=...&type=recovery
    const fragment = typeof window !== "undefined" ? window.location.hash : "";
    const fragmentParams = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);

    const search = typeof window !== "undefined" ? window.location.search : "";
    const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

    const accessToken = fragmentParams.get("access_token") ?? searchParams.get("access_token");
    const refreshToken = fragmentParams.get("refresh_token") ?? searchParams.get("refresh_token");

    return { accessToken, refreshToken };
  }

  useEffect(() => {
    // Try to auto-set session if link contains tokens (typical Supabase recovery flow)
    (async () => {
      try {
        const { accessToken, refreshToken } = parseTokensFromUrl();

        if (!accessToken) {
          // No token present — user will need to use form as usual (if you allow changing password without token)
          setHasTokenInUrl(false);
          setAutoSessionDone(true); // allow form flow anyway
          return;
        }

        setHasTokenInUrl(true);

        // supabase.auth.setSession requires both strings in typings.
        // If refreshToken is missing, cast to any (supabase server may accept).
        // This cast keeps TypeScript quiet while preserving runtime safety checks below.
        const sessionPayload: any = {
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        };

        const { error } = await supabase.auth.setSession(sessionPayload);

        if (error) {
          console.error("Could not auto-set session:", error.message);
        } else {
          console.log("Auto session set from URL tokens");
        }
      } catch (err: any) {
        console.error("Auto session error:", err?.message || err);
      } finally {
        setAutoSessionDone(true);
      }
    })();
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerError(null);

    try {
      // supabase.auth.updateUser requires the user to be signed-in (or a valid session token set above)
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        setServerError(error.message);
        console.error("Password update error:", error);
      } else {
        alert("✅ Password reset successful! You can now login.");
        window.location.href = "/auth";
      }
    } catch (err: any) {
      console.error("Unexpected error updating password:", err);
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // wait until we've attempted auto session before showing the form so flow is deterministic
  if (!autoSessionDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="p-6 bg-white rounded shadow">Validating reset link…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasTokenInUrl && (
            <p className="text-sm text-slate-600 mb-4">
              We couldn't find a password reset token in the link. If you received a recovery email, make sure you clicked the link in the email. Alternatively request a new reset.
            </p>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label>Confirm Password</Label>
              <Input type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
