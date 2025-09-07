import { Express } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase Admin Client (backend only!)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ never expose to frontend
);

export function setupAuth(app: Express) {
  // ✅ Register (handled by Supabase)
  // inside setupAuth(app) — replace current /api/register handler with this
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = z
        .object({ email: z.string().email(), password: z.string().min(8)})
        .parse(req.body);

      // 1) create auth user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

      if (error) {
        console.error("❌ Supabase register error:", error.message);
        return res.status(400).json({ message: error.message });
      }

      const userId = data.user?.id;
      if (!userId) {
        console.error("No user id returned from Supabase createUser", data);
        return res.status(500).json({ message: "Failed to create user" });
      }

      // after creating the auth user and getting userId
      const insertPayload = {
        id: userId,              // use the auth.users id (uuid)
        email,                   // user email
        // DO NOT insert plain password here. If you need a password column for legacy reasons,
        // keep it NULL or maintain its current hashing strategy. We'll leave it out for now.
        created_at: new Date().toISOString(),
      };

      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from("users")
        .insert(insertPayload);

      if (insertError) {
        console.error("Failed to insert public.users row; cleaning up auth user", insertError);
        // optional cleanup
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (delErr) {
          console.error("Cleanup deleteUser error (manual cleanup required):", delErr);
        }
        return res.status(500).json({ message: "Failed to create user record", details: insertError.message });
      }
      // // 2) insert into public.users
      // const insertPayload = {
      //   id: userId,
      //   email,
      //   display_name: displayName ?? null,
      //   created_at: new Date().toISOString(),
      // };

      // const { error: insertError } = await supabaseAdmin.from("users").insert(insertPayload);

      // if (insertError) {
      //   console.error("Failed to insert public.users row; cleaning up auth user", insertError);
      //   // cleanup: remove the previously created auth user to avoid orphan
      //   try {
      //     await supabaseAdmin.auth.admin.deleteUser(userId);
      //   } catch (delErr) {
      //     console.error("Cleanup deleteUser error (manual cleanup required):", delErr);
      //   }
      //   return res.status(500).json({ message: "Failed to create user record" });
      // }

      return res.status(201).json({ user: data.user });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // app.post("/api/register", async (req, res) => {
  //   try {
  //     const { email, password } = z
  //       .object({ email: z.string().email(), password: z.string().min(8) })
  //       .parse(req.body);

  //     const { data, error } = await supabaseAdmin.auth.admin.createUser({
  //       email,
  //       password,
  //       email_confirm: true, // auto-confirm for dev; remove if you want verification
  //     });

  //     if (error) {
  //       console.error("❌ Supabase register error:", error.message);
  //       return res.status(400).json({ message: error.message });
  //     }

  //     res.status(201).json({ user: data.user });
  //   } catch (error) {
  //     console.error("Register error:", error);
  //     res.status(500).json({ message: "Internal server error" });
  //   }
  // });

  // ✅ Login (client should call Supabase directly, but API helper if you want)
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

      res.json({ session: data.session, user: data.user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ✅ Logout (client usually handles this directly)
  app.post("/api/logout", async (_req, res) => {
    try {
      // With Supabase, logout is handled client-side via supabase.auth.signOut()
      res.json({ message: "Logout handled on client" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ✅ Current User
  app.get("/api/user", async (req, res) => {
    // Normally retrieved from Supabase client on frontend
    res.status(400).json({ message: "Use supabase.auth.getUser() on the client" });
  });

  // ✅ Forgot Password via Supabase
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: "https://secure-paste.vercel.app/reset-password",
        },
      });

      if (error) {
        console.error("❌ Supabase reset error:", error.message);
        return res.status(500).json({ message: "Failed to send reset email" });
      }

      res.json({ message: "If the email exists, a reset link will be sent", data });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
