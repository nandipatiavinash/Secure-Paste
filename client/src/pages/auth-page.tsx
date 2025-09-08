// client/src/pages/auth-page.tsx
import { API_URL } from "@/lib/utils";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Lock, Eye, Clock, UserX, Flame } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage(): JSX.Element {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  // LOGIN handler (using Supabase auth)
  const onLogin = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { email, password } = data;
      const resp = await supabase.auth.signInWithPassword({ email, password });
      if (resp.error) {
        setError(resp.error.message || "Failed to sign in");
      } else {
        // success: redirect to home/dashboard
        setLocation("/");
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  // REGISTER handler (server API + optional auto-signin via Supabase)
  const onRegister = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { email, password } = data;

      const resp = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: "" }),
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // ignore parse error — server might respond with plain text
      }

      if (!resp.ok) {
        const msg = json?.message || text || `Request failed (${resp.status})`;
        setError(String(msg));
        return;
      }

      // Optionally auto sign-in (client Supabase) after server registration
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        // registered but signin failed — still redirect or show message
        console.warn("auto sign-in failed:", signIn.error);
      }
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, title: "Malware Detection", description: "Advanced scanning for malicious content" },
    { icon: Lock, title: "End-to-End Encryption", description: "AES encryption with password protection" },
    { icon: Clock, title: "Auto Expiry", description: "Automatic expiration and cleanup" },
    { icon: Eye, title: "Access Monitoring", description: "Detailed access logs and analytics" },
    { icon: UserX, title: "Anonymous Sharing", description: "Share without creating an account" },
    { icon: Flame, title: "Self-Destruct", description: "One-time view for sensitive content" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Auth card (always visible) */}
        <div className="w-full flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold">Welcome to SecurePaste</CardTitle>
              <p className="text-slate-600 text-sm">Secure text and code sharing platform</p>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Sign Up</TabsTrigger>
                </TabsList>

                {/* LOGIN */}
                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4" aria-live="polite">
                    <div>
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" type="email" placeholder="you@example.com" {...loginForm.register("email")} />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" type="password" placeholder="••••••••" {...loginForm.register("password")} />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>

                  <p className="text-sm mt-3 text-center">
                    <a href="/forgot-password" className="text-blue-600 hover:underline">
                      Forgot Password?
                    </a>
                  </p>
                </TabsContent>

                {/* REGISTER */}
                <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4" aria-live="polite">
                    <div>
                      <Label htmlFor="reg-email">Email</Label>
                      <Input id="reg-email" type="email" placeholder="you@example.com" {...registerForm.register("email")} />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="reg-password">Password</Label>
                      <Input id="reg-password" type="password" placeholder="Minimum 8 characters" {...registerForm.register("password")} />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="reg-confirm">Confirm Password</Label>
                      <Input id="reg-confirm" type="password" placeholder="Repeat password" {...registerForm.register("confirmPassword")} />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                      {loading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right: Feature panel (hidden below lg) */}
        <aside className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-primary/80 to-primary/60 text-primary-foreground rounded-xl p-8">
          <div className="max-w-md space-y-6">
            <h2 className="text-3xl font-bold">Secure, Private, & Protected</h2>
            <p className="text-sm text-primary-foreground/90">
              Share your code and sensitive data with confidence. Built-in security scanning, encryption, and privacy controls.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{f.title}</h3>
                      <p className="text-xs opacity-90">{f.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}// client/src/pages/paste-view.tsx
