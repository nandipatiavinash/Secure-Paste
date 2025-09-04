// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

declare global {
  // Augment express-user with your shape from @shared/schema
  namespace Express {
    interface User extends SelectUser {}
  }
}

/**
 * Supabase clients
 * - supabase: non-admin (uses ANON key) → for signInWithPassword, getUser, etc.
 * - supabaseAdmin: admin (SERVICE_ROLE key) → for createUser, generate reset links, etc.
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Require required envs early
const requiredEnvs = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
];
for (const k of requiredEnvs) {
  if (!process.env[k]) {
    throw new Error(`❌ Missing env: ${k}`);
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function setupAuth(app: Express) {
  // Sessions (keep your same store)
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS on Render
      httpOnly: true,
      sameSite: "none", // frontend on Vercel; cross-site cookies
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  // Behind proxy on Render so cookies marked secure work
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // === PASSPORT STRATEGY ===
  // Delegate password verification to Supabase.
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data?.user) {
          return done(null, false);
        }

        // Find or create your local profile linked to Supabase user id
        let user = await storage.getUserByEmail(email);
        if (!user) {
          user = await storage.createUser({
            // If your table generates its own id, remove `id:` and only store auth_user_id
            id: data.user.id as unknown as string,
            email,
            password: "", // no local password now
            // @ts-ignore - ensure your createUser accepts this field or add migration (see SQL below)
            auth_user_id: data.user.id,
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // === ROUTES ===

  // Register — create in Supabase Auth, then your local profile
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password } = registerSchema.parse(req.body);

      // Avoid duplicate email locally (optional; Supabase will also enforce)
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // set to false if you want email confirmation flow
      });
      if (error || !created?.user) {
        return res.status(400).json({ message: error?.message ?? "Failed to create user" });
      }

      const user = await storage.createUser({
        id: created.user.id as unknown as string,
        email,
        password: "",
        // @ts-ignore ensure column exists
        auth_user_id: created.user.id,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: user.id, email: user.email, createdAt: user.createdAt });
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: e.errors });
      }
      next(e);
    }
  });

  // Login — use Passport (which calls Supabase under the hood)
  app.post("/api/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }

    passport.authenticate("local", (err: any, user: SelectUser | false) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ id: user.id, email: user.email, createdAt: user.createdAt });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...rest } = req.user!;
    res.json(rest);
  });

  // Forgot Password — send Supabase recovery email
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          // your Vercel frontend reset page
          redirectTo: "https://secure-paste-six.vercel.app/reset-password",
        },
      });

      if (error) {
        console.error("❌ Supabase reset error:", error.message);
        return res.status(500).json({ message: "Failed to send reset email" });
      }

      res.json({ message: "If the email exists, a reset link will be sent" });
    } catch (e) {
      console.error("Forgot password error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Optional health for Render
  app.get("/api/health", (_req, res) => res.send("ok"));
}
