// client/src/pages/auth-page.tsx
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
import { API_URL } from "@/lib/utils";

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

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("login");
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

  // LOGIN (client sign-in)
  const onLogin = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setError(error.message);
      } else {
        try {
          // ✅ After login, upsert into public.users
          const userId = loginData.user?.id;
          if (userId) {
            await fetch(`${API_URL}/api/post-confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: userId, email }),
            });
          }
        } catch (postErr) {
          console.warn("post-confirm failed:", postErr);
        }
        // signed in: navigate home
        setLocation("/");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // REGISTER (client-side so Supabase sends the confirmation email)
  const onRegister = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        // optional: you can pass `options: { data: { ... } }` for user_metadata
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Success: Supabase will send confirmation email. Inform user.
      // Don't auto-redirect to a protected page — show instruction to check email.
      alert("Registration successful. Please check your email and confirm your account before signing in.");
      setActiveTab("login");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // rest of the component: UI (same as you posted)...
  const features = [
    { icon: Shield, title: "Malware Detection", description: "Advanced scanning for malicious content" },
    { icon: Lock, title: "End-to-End Encryption", description: "AES encryption with password protection" },
    { icon: Clock, title: "Auto Expiry", description: "Automatic expiration and cleanup" },
    { icon: Eye, title: "Access Monitoring", description: "Detailed access logs and analytics" },
    { icon: UserX, title: "Anonymous Sharing", description: "Share without creating an account" },
    { icon: Flame, title: "Self-Destruct", description: "One-time view for sensitive content" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to SecurePaste</CardTitle>
            <p className="text-slate-600 text-sm">Secure text and code sharing platform</p>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" {...loginForm.register("email")} />
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" {...loginForm.register("password")} />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                <p className="text-sm mt-3 text-center">
                  <a href="/forgot-password" className="text-blue-600 hover:underline">Forgot Password?</a>
                </p>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" {...registerForm.register("email")} />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" {...registerForm.register("password")} />
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Confirm Password</Label>
                    <Input type="password" {...registerForm.register("confirmPassword")} />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-10 items-center justify-center">
        <div className="max-w-lg space-y-6">
          <h1 className="text-3xl font-bold">Secure, Private, & Protected</h1>
          <p className="text-lg text-primary-foreground/90">Share your code and sensitive data with confidence.</p>
        </div>
      </div>
    </div>
  );
}
