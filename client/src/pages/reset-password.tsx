// client/src/pages/reset-password.tsx
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
          setHasTokenInUrl(false);
          setAutoSessionDone(true); // allow form flow anyway
          return;
        }

        setHasTokenInUrl(true);

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
        <div className="p-6 bg-white rounded shadow text-sm">Validating reset link…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6">
      <Card className="w-full max-w-md sm:max-w-lg shadow-lg">
        <CardHeader className="text-center px-6 pt-6">
          <CardTitle className="text-xl sm:text-2xl font-bold">Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!hasTokenInUrl && (
            <p className="text-sm text-slate-600 mb-4">
              We couldn't find a password reset token in the link. If you received a recovery email, make sure you clicked the link in the email. Alternatively request a new reset.
            </p>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-sm">New Password</Label>
              <Input
                type="password"
                {...form.register("password")}
                className="w-full text-sm"
                aria-invalid={!!form.formState.errors.password}
                placeholder="At least 8 characters"
              />
              {form.formState.errors.password && (
                <p role="alert" className="text-sm text-red-500 mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm">Confirm Password</Label>
              <Input
                type="password"
                {...form.register("confirmPassword")}
                className="w-full text-sm"
                aria-invalid={!!form.formState.errors.confirmPassword}
                placeholder="Repeat new password"
              />
              {form.formState.errors.confirmPassword && (
                <p role="alert" className="text-sm text-red-500 mt-1">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* server feedback */}
            <div aria-live="polite" className="min-h-[1.5rem]">
              {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            </div>

            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
