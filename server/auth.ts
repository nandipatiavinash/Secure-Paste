// server/auth.ts
import { Express, Request, Response, NextFunction } from "express";
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
  app.post("/api/register", async (_req, res) => {
    return res.status(405).json({
      message:
        "Use client-side supabase.auth.signUp() for normal signups so confirmation emails are sent. Server-side createUser is reserved for admin use.",
    });
  });

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

  app.post("/api/logout", async (_req, res) => {
    return res.json({ message: "Logout should be handled on client via supabase.auth.signOut()" });
  });

  app.get("/api/user", async (_req, res) => {
    return res.status(400).json({ message: "Use supabase.auth.getUser() on the client" });
  });

  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo:
            process.env.FRONTEND_BASE_URL?.replace(/\/$/, "") + "/reset-password" ??
            "https://your-frontend/reset-password",
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

// 👇 standalone middleware, not inside setupAuth
export async function attachSupabaseUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = (req.headers["authorization"] || "") as string;
    if (!auth.startsWith("Bearer ")) return next();

    const token = auth.split(" ")[1].trim();
    if (!token) return next();

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.warn("[auth] supabase token validation failed:", error.message || error);
      return next();
    }

    const user = data?.user;
    if (!user) return next();

    // @ts-ignore attach to req
    req.user = {
      id: user.id,
      email: user.email ?? undefined,
      raw: user,
    };

    return next();
  } catch (err) {
    console.warn("[auth] attachSupabaseUser unexpected error:", err);
    return next();
  }
}
