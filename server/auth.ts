import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";
import { Resend } from "resend";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// ✅ Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY!);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function setupAuth(app: Express) {
  // Session settings
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production", // only send over HTTPS
      httpOnly: true,
      sameSite: "none", // allow cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport Local Strategy
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
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

  // Register
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password } = registerSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser({
        email,
        password: await hashPassword(password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: user.id, email: user.email, createdAt: user.createdAt });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      next(error);
    }
  });

  // Login
  app.post("/api/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
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

  // Current User
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // ✅ Forgot Password (send real email via Resend)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Do not reveal if email exists
        return res.json({ message: "If the email exists, a reset link will be sent" });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      await storage.createPasswordReset({ userId: user.id, token, expiresAt });

      const resetUrl = `https://secure-paste.vercel.app/reset-password?token=${token}`;

      try {
        const response = await resend.emails.send({
          from: "onboarding@resend.dev", // ✅ works out of the box
          to: user.email,
          subject: "Password Reset - SecurePaste",
          html: `
            <p>Hello,</p>
            <p>You requested a password reset. Click the link below to reset:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link will expire in 1 hour.</p>
          `,
        });

        console.log("📧 Resend response:", response); // ✅ check Render logs
        res.json({ message: "If the email exists, a reset link will be sent" });
      } catch (sendError: any) {
        console.error("❌ Resend email error:", sendError);
        res.status(500).json({ message: "Failed to send reset email" });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // // ✅ Forgot Password (send real email via Resend)
  // app.post("/api/forgot-password", async (req, res) => {
  //   try {
  //     const { email } = z.object({ email: z.string().email() }).parse(req.body);

  //     const user = await storage.getUserByEmail(email);
  //     if (!user) {
  //       // Do not reveal if email exists
  //       return res.json({ message: "If the email exists, a reset link will be sent" });
  //     }

  //     const token = randomBytes(32).toString("hex");
  //     const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  //     await storage.createPasswordReset({ userId: user.id, token, expiresAt });

  //     const resetUrl = `https://secure-paste.vercel.app/reset-password?token=${token}`;

  //     await resend.emails.send({
  //       from: "onboarding@resend.dev", // ✅ works for dev, replace with your verified domain in production
  //       to: user.email,
  //       subject: "Password Reset - SecurePaste",
  //       html: `
  //         <p>Hello,</p>
  //         <p>You requested a password reset. Click the link below to reset:</p>
  //         <p><a href="${resetUrl}">${resetUrl}</a></p>
  //         <p>This link will expire in 1 hour.</p>
  //       `,
  //     });

  //     res.json({ message: "If the email exists, a reset link will be sent" });
  //   } catch (error) {
  //     console.error("Forgot password error:", error);
  //     res.status(500).json({ message: "Internal server error" });
  //   }
  // });

  // Reset Password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(8),
      }).parse(req.body);

      const reset = await storage.getPasswordReset(token);
      if (!reset) return res.status(400).json({ message: "Invalid or expired reset token" });

      const hashedPassword = await hashPassword(password);
      await storage.updateUser(reset.userId, { password: hashedPassword });
      await storage.markPasswordResetUsed(reset.id);

      res.json({ message: "Password reset successful" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
