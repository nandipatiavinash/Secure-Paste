import express, { type Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors, { CorsOptions } from "cors";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth"; // ⬅️ ADD THIS

dotenv.config();
const app = express();

/** ---------- CORS (must be before routes/middleware) ---------- */
const allowedOrigins = [
  "http://localhost:5173",                 // local dev (Vite)
  "http://localhost:3000",                 // local dev (Next)
  "https://secure-paste-six.vercel.app",   // ⬅️ your prod frontend
];
const vercelPattern = /\.vercel\.app$/;    // allow all Vercel preview URLs

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      vercelPattern.test(origin)
    ) {
      callback(null, true);
    } else {
      console.warn("CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // allow cookies/sessions across domains
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle preflight

/** ---------- JSON parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/** ---------- Trust proxy (Render) so secure cookies work ---------- */
app.set("trust proxy", 1); // ⬅️ IMPORTANT for SameSite=None; Secure cookies

/** ---------- Health check ---------- */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/** ---------- Logging (unchanged) ---------- */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  /** ---------- Auth/session must be BEFORE routes ---------- */
  setupAuth(app); // ⬅️ This registers express-session + passport

  /** ---------- Your API routes (require sessions/cookies) ---------- */
  const server = await registerRoutes(app);

  /** ---------- Error handler ---------- */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  /** ---------- Dev vs static ---------- */
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else if (process.env.SERVE_STATIC === "true") {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || "3001", 10);
  server.listen(PORT, () => {
    log(`✅ Server running at http://localhost:${PORT}`);
  });
})();
