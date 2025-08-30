import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
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
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ id: user.id, email: user.email, createdAt: user.createdAt });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Password reset functionality
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return res.json({ message: "If the email exists, a reset link will be sent" });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordReset({
        userId: user.id,
        token,
        expiresAt,
      });

      // TODO: Send email with reset link
      // For now, just return the token (in production, send via email)
      res.json({ 
        message: "If the email exists, a reset link will be sent",
        resetToken: token // Remove this in production
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(8),
      }).parse(req.body);

      const reset = await storage.getPasswordReset(token);
      if (!reset) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

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
