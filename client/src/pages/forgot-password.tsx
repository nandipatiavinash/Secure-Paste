// client/src/pages/forgot-password.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // ensure this points to your initialized supabase client
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setServerMessage(null);
    setError(null);

    // Use current origin so reset redirect works across environments (dev/staging/prod)
    const redirectTo = `${window.location.origin}/reset-password`;

    const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    if (supabaseError) {
      setError(supabaseError.message);
    } else {
      setServerMessage("✅ Check your email for a reset link.");
      form.reset();
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-lg sm:max-w-md shadow-lg">
        <CardHeader className="text-center px-6 pt-6">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            Enter your email and we'll send you a reset link.
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                aria-label="Email address"
                type="email"
                placeholder="your@email.com"
                {...form.register("email")}
                className="w-full"
                autoComplete="email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500 mt-1" role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Feedback messages */}
            {serverMessage && (
              <p className="text-sm text-green-600" role="status">
                {serverMessage}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full py-3 text-sm"
              disabled={loading}
              aria-disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            {/* Small helper text for mobile clarity */}
            <div className="text-xs text-slate-500 text-center mt-1">
              If you don't receive an email, check your spam folder or try again.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
