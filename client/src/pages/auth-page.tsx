import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Lock, Eye, Clock, UserX, Flame } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; // ✅ Create a supabase client instance
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

  // Forms
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  // // LOGIN
  // const onLogin = async (data: LoginFormData) => {
  //   setLoading(true);
  //   setError(null);
  //   const { email, password } = data;
  
  //   const { error } = await supabase.auth.signInWithPassword({ email, password });
  //   if (error) {
  //     setError(error.message);
  //   } else {
  //     setLocation("/");
  //   }
  //   setLoading(false);
  // };
  
  // // REGISTER
  // const onRegister = async (data: RegisterFormData) => {
  //   setLoading(true);
  //   setError(null);
  //   const { email, password } = data;
  
  //   const { error } = await supabase.auth.signUp({ email, password });
  //   if (error) {
  //     setError(error.message);
  //   } else {
  //     // user will have to confirm email (unless you change project settings)
  //     setLocation("/");
  //   }
  //   setLoading(false);
  // };

  // ✅ Login
  const onLogin = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    const { email, password } = data;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setLocation("/");
    }
    setLoading(false);
  };

  // ✅ Register
  // client/src/pages/auth-page.tsx -> onRegister
  const onRegister = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);
    const { email, password } = data;

    try {
      const resp = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: "" }),
      });

      // Read text first (safe), then try parse
      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn("Response not JSON:", text);
      }

      if (!resp.ok) {
        const message = json?.message || text || `Request failed (${resp.status})`;
        setError(message);
        console.error("register error:", resp.status, text);
        return;
      }

      // success: if server returned json user, you can use it; otherwise proceed
      console.log("register success:", resp.status, json);
      // optionally sign in automatically:
      // after register success
      const loginRes = await supabase.auth.signInWithPassword({ email, password });
      if (loginRes.error) {
        // show friendly message; user exists but could not auto-login
        setError(loginRes.error.message);
      } else {
        setLocation("/"); // now logged in
      }
      // await supabase.auth.signInWithPassword({ email, password });
      // setLocation("/");
    } catch (err: any) {
      console.error("Network or unexpected error:", err);
      setError(err.message || "Registration failed");\
    } finally {
      setLoading(false);
    }
  };
  // const onRegister = async (data: RegisterFormData) => {
  //   setLoading(true);
  //   setError(null);
  //   const { email, password } = data;

  //   try {
  //     const resp = await fetch("/api/register", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ email, password, displayName: "" }), // pass displayName if available
  //     });
  //     const payload = await resp.json();
  //     if (!resp.ok) {
  //       setError(payload?.message || "Registration failed");
  //     } else {
  //       // Optionally sign the user in automatically on the client:
  //       await supabase.auth.signInWithPassword({ email, password });
  //       setLocation("/");
  //     }
  //   } catch (err: any) {
  //     setError(err.message || "Registration failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  // const onRegister = async (data: RegisterFormData) => {
  //   setLoading(true);
  //   setError(null);
  //   const { email, password } = data;

  //   const { error } = await supabase.auth.signUp({ email, password });
  //   if (error) {
  //     setError(error.message);
  //   } else {
  //     setLocation("/");
  //   }
  //   setLoading(false);
  // };

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
      {/* Left side - Auth form */}
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

              {/* 🔑 LOGIN */}
              <TabsContent value="login">
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" placeholder="your@email.com" {...loginForm.register("email")} />
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" placeholder="••••••••" {...loginForm.register("password")} />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500 mt-1">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
                {/* Forgot Password link */}
                <p className="text-sm mt-3 text-center">
                  <a href="/forgot-password" className="text-blue-600 hover:underline">
                    Forgot Password?
                  </a>
                </p>
              </TabsContent>

              {/* 🔑 REGISTER */}
              <TabsContent value="register">
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" placeholder="your@email.com" {...registerForm.register("email")} />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" placeholder="••••••••" {...registerForm.register("password")} />
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-red-500 mt-1">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Confirm Password</Label>
                    <Input type="password" placeholder="••••••••" {...registerForm.register("confirmPassword")} />
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

      {/* Right side - Features */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-10 items-center justify-center">
        <div className="max-w-lg space-y-6">
          <h1 className="text-3xl font-bold">Secure, Private, & Protected</h1>
          <p className="text-lg text-primary-foreground/90">
            Share your code and sensitive data with confidence. Built-in security scanning, encryption, and privacy controls.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary-foreground/10 rounded-lg flex items-center justify-center">
                  <f.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{f.title}</h3>
                  <p className="text-xs text-primary-foreground/70">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
