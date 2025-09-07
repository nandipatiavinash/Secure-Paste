// server/auth.ts
import { Express } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing - server admin features will fail.");
}

// Supabase Admin Client (backend only!)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export function setupAuth(app: Express) {
  /**
   * NOTE: Normal user signup should be done on the CLIENT with supabase.auth.signUp({ email, password })
   * That ensures Supabase sends confirmation emails and the standard flows work.
   *
   * This /api/register is intentionally disabled for normal signups to avoid admin-created users
   * which bypass the normal confirm email flow. If you want admin creation later, we can provide
   * a secured admin-only route.
   */
  app.post("/api/register", async (_req, res) => {
    return res.status(405).json({
      message:
        "Use client-side supabase.auth.signUp() for normal signups so confirmation emails are sent. Server-side createUser is reserved for admin use.",
    });
  });

  // Login: optional server helper (but frontend usually calls Supabase directly)
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = z
        .object({ email: z.string().email(), password: z.string() })
        .parse(req.body);

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ message: error.message });
      }

      return res.json({ session: data.session, user: data.user });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * post-confirm: idempotent endpoint to upsert a public.users row using the service role key.
   * Call this from the client AFTER the user has confirmed email and/or has successfully signed in.
   *
   * Body: { id: string, email: string }
   */
  app.post("/api/post-confirm", async (req, res) => {
    try {
      const { id, email } = req.body ?? {};
      if (!id || !email) {
        return res.status(400).json({ message: "id and email required in body" });
      }

      const payload = { id, email, created_at: new Date().toISOString() };
      const { data, error } = await supabaseAdmin
        .from("users")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        console.error("post-confirm upsert error:", JSON.stringify(error, null, 2));
        return res.status(500).json({ message: "Failed to upsert user", details: error.message });
      }

      return res.json({ ok: true, user: data?.[0] ?? null });
    } catch (err) {
      console.error("post-confirm error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout (client-side preferred)
  app.post("/api/logout", async (_req, res) => {
    return res.json({ message: "Logout should be handled on client via supabase.auth.signOut()" });
  });

  // Current user placeholder (recommend client uses supabase.auth.getUser())
  app.get("/api/user", async (_req, res) => {
    return res.status(400).json({ message: "Use supabase.auth.getUser() on the client" });
  });

  // Forgot password: generate recovery link via admin.generateLink (server)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          // adjust redirectTo to your front-end reset page
          redirectTo: process.env.FRONTEND_BASE_URL?.replace(/\/$/, "") + "/reset-password" ?? "https://your-frontend/reset-password",
        },
      });

      if (error) {
        console.error("Supabase reset error:", error);
        return res.status(500).json({ message: "Failed to send reset email", details: error.message });
      }

      return res.json({ message: "If the email exists, a reset link will be sent", data });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
