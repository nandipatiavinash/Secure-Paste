import type { Express } from "express";
import { Request, Response, NextFunction } from "express"; // 👈 Add Request, Response, NextFunction
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { malwareScanner } from "./services/malware-scanner";
import { encryptionService } from "./services/encryption";
import { VirusTotalService } from "./services/virustotal";
import crypto from "crypto";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";
//import signupRouter from "./routes/signup"; 

import {
  insertPasteSchema,
} from "@shared/schema";
import { z } from "zod";

/**
 * Ensures the request is authenticated by checking for a user on the request object.
 * This middleware should be applied to routes that require a logged-in user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 👈 Use correct Express types
  if (!req.user?.id) { // 👈 Check for req.user?.id instead of req.isAuthenticated()
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

/** Extract ALL URLs, normalize a bit, and dedupe */
function extractAllUrls(text: string): string[] {
  const matches = text.match(/\bhttps?:\/\/[^\s)]+/gi) || [];
  const cleaned = matches.map((u) => u.replace(/[),.;]+$/g, ""));
  return Array.from(new Set(cleaned));
}

/** Extract bare domains (not starting with http(s)://), dedupe, and remove those already covered by URLs */
function extractDomains(text: string, urls: string[]): string[] {
  const DOMAIN_REGEX = /\b(?!(?:https?:\/\/))([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
  const raw = text.match(DOMAIN_REGEX) || [];
  const cleaned = raw.map((d) => d.trim().toLowerCase().replace(/\.$/, ""));
  const unique = Array.from(new Set(cleaned));
  // avoid duplicating effort if the domain is already inside a matched URL
  return unique.filter((d) => !urls.some((u) => u.includes(d)));
}

/** Get the client's IP address from the request. */
function getClientIP(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string' && xf.trim().length > 0) {
    // x-forwarded-for can be comma-separated; use first ip
    return xf.split(',')[0].trim();
  }
  // fallback chain
  return (
    req.ip ||
    // @ts-ignore - some types don't include connection.remoteAddress
    (req.connection && (req.connection as any).remoteAddress) ||
    (req.socket && (req.socket as any).remoteAddress) ||
    "0.0.0.0"
  );
}

export function registerRoutes(app: Express): Server {
setupAuth(app);

  // If this server sits behind a proxy (Vercel, Cloudflare, etc.), enable this so Express
  // will use x-forwarded-for for req.ip. Only enable for trusted deployments.
  app.set('trust proxy', true);

  // TEMP DEBUG: log all incoming requests (remove once solved)
  app.use((req, res, next) => {
    console.log('[REQ-DBG]', {
      method: req.method,
      url: req.originalUrl,
      xff: req.headers['x-forwarded-for'],
      ip: req.ip,
      sockRemote: req.socket && (req.socket.remoteAddress || null),
      ua: req.get('User-Agent'),
    });
    next();
  });
    // DEBUG: temporary request logging — remove when done
  app.use((req, res, next) => {
    console.log('[REQ-DBG]', {
      method: req.method,
      url: req.originalUrl,
      // show proxied header explicitly
      xff: req.headers['x-forwarded-for'],
      ip: req.ip,
      sockRemote: req.socket && (req.socket.remoteAddress || null),
      ua: req.get('User-Agent'),
    });
    next();
  });
  // 1) CORS first so preflight (OPTIONS) works without auth
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          "http://localhost:5173",
          "https://secure-paste.vercel.app",
          "https://secure-paste-six.vercel.app",
        ];
        const vercelPattern = /\.vercel\.app$/;

        if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
          callback(null, true);
        } else {
          console.warn("CORS blocked:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );
  /* ------------------- Explicit view endpoint (client calls on mount) ------------------- */
  app.post("/api/pastes/:id/view", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // attempt to insert one access log (best-effort, don't block)
    try {
      const log = await storage.createAccessLog({
        pasteId: id,
        viewerIp: getClientIP(req),
        userAgent: req.get("User-Agent") || "",
      });
      console.log('[VIEW-ENDPOINT-LOGGED]', { pasteId: id, logId: log?.id ?? null });
    } catch (err) {
      console.error('[VIEW-ENDPOINT-LOG-ERROR] createAccessLog failed', err);
    }

    // increment paste viewCount (best-effort)
    try {
      await storage.incrementPasteViews(id);
    } catch (err) {
      console.error('[VIEW-ENDPOINT-INC-ERROR] incrementPasteViews failed', err);
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[VIEW-ENDPOINT] unexpected error', err);
    return res.status(500).json({ message: "Failed to record view" });
  }
});

  
  // allow preflight on API routes
  app.options("/api/*", cors());

  // 2) Apply auth middleware to /api routes only
  app.use("/api", authMiddleware);

    // 👈 Mount the new signup router
  //app.use("/auth", signupRouter);

 /* --------------------------- Create paste --------------------------- */
app.post("/api/pastes", requireAuth, async (req: Request, res: Response) => { // 👈 Use requireAuth and proper types
  try {
    const pasteData = insertPasteSchema.parse(req.body);

    // Handle encryption (never store raw password)
    let content = pasteData.content;
    let password = pasteData.password;
    if (pasteData.encrypted && password) {
      content = encryptionService.encrypt(pasteData.content, password);
      password = undefined;
    }

    // Local scan (PII/malware heuristics; URLs handled by VT below)
    const local = malwareScanner.scan(pasteData.content);
    const urls = extractAllUrls(pasteData.content);
    const domains = extractDomains(pasteData.content, urls);

    // Filter out URL-only notices from local scan; VT decides URL risk
    const filteredLocalThreats = Array.isArray(local.threats)
      ? local.threats.filter((t: string) => !/^\s*URL\b/i.test(t))
      : [];

    // Info notes (non-blocking hints)
    const infoNotes: string[] = urls.length
      ? [`${urls.length} URL${urls.length > 1 ? "s" : ""} detected in content`]
      : [];

    // Respect `force` to override blocking on findings
    const force = Boolean((req.body as any)?.force ?? false); // 👈 Use 'as any' for force property
    if ((local.sensitiveData?.length || filteredLocalThreats.length) && !force) {
      return res.status(422).json({
        message: "Sensitive or potentially unsafe content detected",
        sensitiveData: local.sensitiveData,
        threats: filteredLocalThreats,
        urls,
        hint: "Resubmit with { force: true } to proceed anyway.",
      });
    }

    // ---------- Optional VirusTotal scan for ALL URLs ----------
    const MAX_URLS_TO_SCAN = 5;

    type VtPerUrl = {
      url: string;
      malicious: boolean;
      suspicious: boolean;
      clean: boolean;
      positives?: number;
      total?: number;
      detections?: string[];
      scanDate?: string;
      error?: string;
    };

    const vtResults: VtPerUrl[] = [];
    const vtThreatLabels: string[] = [];
    console.log("[VT] urls:", urls);

       try {
      // 👈 Use non-null assertion as requireAuth guarantees existence
      const settings = await storage.getUserSettings(req.user!.id);
      const masterKey = process.env.MASTER_ENCRYPTION_KEY || "default-master-key";

      let apiKeyFromSettings: string | null = null;
      if (settings?.virusTotalApiKey) {
        try {
          apiKeyFromSettings = encryptionService.decryptApiKey(settings.virusTotalApiKey, masterKey);
        } catch (e) {
          console.warn("VirusTotal key decryption failed; will try env fallback.", e);
        }
      }

      const apiKeyEnv = (process.env.VIRUSTOTAL_API_KEY || "").trim();
      const apiKey = (apiKeyFromSettings?.trim() || "") || apiKeyEnv;
      const vtConfigured = Boolean(apiKey);
      console.log("[VT] urls:", urls, "vtConfigured?", vtConfigured);

      if (vtConfigured && (urls.length > 0 || domains.length > 0)) {
        const vtService = new VirusTotalService();

        // 1) Scan DOMAINS first (VT UI “12/94 vendors flagged this domain” comes from the domain object)
        const MAX_DOMAINS_TO_SCAN = 5;
        for (const d of domains.slice(0, MAX_DOMAINS_TO_SCAN)) {
          try {
            const r = await vtService.scanDomain(d, apiKey); // <-- new method (see Step 3)
            if (r.malicious) {
              vtThreatLabels.push(`VirusTotal: malicious domain (${d}) — ${r.positives}/${r.total} engines flagged`);
            } else if (r.suspicious) {
              vtThreatLabels.push(`VirusTotal: suspicious domain (${d}) — ${r.positives}/${r.total} engines flagged`);
            }
          } catch (e: any) {
            infoNotes.push(`VirusTotal scan failed for domain ${d}`);
          }
        }
        if (domains.length > MAX_DOMAINS_TO_SCAN) {
          infoNotes.push(
            `Scanned only first ${MAX_DOMAINS_TO_SCAN} domain(s) due to rate limits; ${domains.length - MAX_DOMAINS_TO_SCAN} left unscanned.`
          );
        }

        // 2) Scan URLs (unchanged logic, keeps your vtResults array for URLs)
        for (const url of urls.slice(0, MAX_URLS_TO_SCAN)) {
          try {
            const resVt = await vtService.scanUrl(url, apiKey, {
              overallTimeoutMs: 12000,
              perRequestTimeoutMs: 5000,
              pollIntervalMs: 1000,
            });
            const clean = resVt.malicious === false && resVt.suspicious === false;

            vtResults.push({
              url,
              malicious: !!resVt.malicious,
              suspicious: !!resVt.suspicious,
              clean,
              positives: resVt.positives,
              total: resVt.total,
              detections: resVt.detections,
              scanDate: resVt.scanDate,
            });

            if (resVt.malicious) vtThreatLabels.push(`VirusTotal: malicious URL (${url})`);
            else if (resVt.suspicious) vtThreatLabels.push(`VirusTotal: suspicious URL (${url})`);
          } catch (scanErr) {
            vtResults.push({ url, malicious: false, suspicious: false, clean: false, error: "VirusTotal scan failed" });
            infoNotes.push(`VirusTotal scan failed for ${url}`);
          }
        }

        if (urls.length > MAX_URLS_TO_SCAN) {
          infoNotes.push(
            `Scanned only first ${MAX_URLS_TO_SCAN} URL(s) due to rate limits; ${urls.length - MAX_URLS_TO_SCAN} left unscanned.`
          );
        }
      } else if (urls.length > 0) {
        infoNotes.push("VirusTotal not configured; URLs were not scanned.");
        console.warn("VirusTotal not configured: no user key and no VIRUSTOTAL_API_KEY in env.");
      }
    } catch (e) {
      console.warn("VirusTotal scanning skipped/failed:", e);
      if (urls.length > 0) infoNotes.push("VirusTotal scanning error; URL risk unknown.");
    }

    // Combine threat signals for server decision
    const hasSensitive = (local.sensitiveData?.length ?? 0) > 0;
    const combinedThreats = [...filteredLocalThreats, ...vtThreatLabels];
    const hasThreats = combinedThreats.length > 0;

    if ((hasSensitive || hasThreats) && !force) {
      return res.status(422).json({
        message: "Sensitive or potentially unsafe content detected",
        sensitiveData: local.sensitiveData,
        threats: combinedThreats,
        urls,
        vtResults,
        hint: "Resubmit with { force: true } to proceed anyway.",
      });
    }

    // Determine scan status and persist structured results
    const scanStatus: "clean" | "flagged" = hasSensitive || hasThreats ? "flagged" : "clean";
    const scanResults = {
      local: { ...local, threats: filteredLocalThreats },
      vt: vtResults,
      urls,
      info: infoNotes,
    };

    const paste = await storage.createPaste({
      ...pasteData,
      content,
      password,
      ownerId: req.user!.id, // 👈 Use non-null assertion
      scanStatus,
      scanResults: JSON.stringify(scanResults),
    });

    return res.status(201).json({
      id: paste.id,
      scanResult: scanStatus,
      threats: combinedThreats,
      sensitiveData: local.sensitiveData || [],
      info: infoNotes,
      urls,
      vtResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to create paste" });
  }
});

  /* ---------------------------- My pastes ---------------------------- */
  app.get("/api/my-pastes", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const pastes = await storage.getUserPastes(req.user!.id); // 👈 Use non-null assertion
      return res.json(
        pastes.map((p) => ({
          id: p.id,
          title: p.title,
          language: p.language,
          viewCount: p.viewCount,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
          encrypted: p.encrypted,
          selfDestruct: p.selfDestruct,
          scanStatus: p.scanStatus,
        }))
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to retrieve pastes" });
    }
  });

  /* ---------------------------- Delete paste ---------------------------- */
  app.delete("/api/pastes/:id", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { id } = req.params;
      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user!.id) { // 👈 Use non-null assertion
        return res.status(403).json({ message: "Not authorized to delete" });
      }
      await storage.deletePasteCascade(id);
      return res.json({ message: "Paste deleted successfully" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to delete paste" });
    }
  });

  /* ---------------------------- Get paste by ID ---------------------------- */
  app.get("/api/pastes/:id", async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { id } = req.params;
      const { password } = req.query;

      const paste = await storage.getPaste(id);
      if (!paste) {
        return res.status(404).json({ message: "Paste not found" });
      }

      // log access
            // log access — don't block paste serving if logging fails
      /*try {
        const log = await storage.createAccessLog({
          pasteId: id,
          viewerIp: getClientIP(req),
          userAgent: req.get("User-Agent") || "",
        });
        console.log('[ACCESS-LOG-INSERTED]', { pasteId: id, logId: log?.id ?? null });
      } catch (err) {
        console.error('[ACCESS-LOG-ERROR] createAccessLog failed', err);
      }*/

      let content = paste.content;
      if (paste.encrypted) {
        if (!password) {
          return res.status(401).json({ message: "Password required for encrypted paste" });
        }
        try {
          content = encryptionService.decrypt(paste.content, String(password));
        } catch {
          return res.status(401).json({ message: "Invalid password" });
        }
      }

      // 👈 Safely check for req.user?.id
      return res.json({
        id: paste.id,
        content,
        title: paste.title,
        language: paste.language,
        viewCount: paste.viewCount,
        createdAt: paste.createdAt,
        expiresAt: paste.expiresAt,
        encrypted: paste.encrypted,
        selfDestruct: paste.selfDestruct,
        scanStatus: paste.scanStatus,
        isOwner: paste.ownerId === req.user?.id,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to retrieve paste" });
    }
  });

  /* ----------------------------- Access logs ----------------------------- */
  app.get("/api/pastes/:id/logs", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { id } = req.params;
      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user!.id) { // 👈 Use non-null assertion
        return res.status(403).json({ message: "Not authorized to view logs" });
      }
      const logs = await storage.getPasteAccessLogs(id);
      return res.json(logs);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to retrieve access logs" });
    }
  });

  /* ---------------------------- Settings (safe) ---------------------------- */
  app.get("/api/settings", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const userId = req.user!.id; // 👈 Use non-null assertion
  
      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          emailNotifications: true,
          defaultExpiry: "1day",
        });
      }
  
      return res.json({
        emailNotifications: settings.emailNotifications,
        defaultExpiry: settings.defaultExpiry,
        hasVirusTotalKey: !!settings.virusTotalApiKey,
      });
    } catch {
      return res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const userId = req.user!.id; // 👈 Use non-null assertion
  
      const masterKey = process.env.MASTER_ENCRYPTION_KEY || "default-master-key";
      const updates: any = { userId };
  
      if (typeof req.body.emailNotifications === "boolean") {
        updates.emailNotifications = req.body.emailNotifications;
      }
      if (typeof req.body.defaultExpiry === "string") {
        updates.defaultExpiry = req.body.defaultExpiry;
      }
  
      // three-way behavior for VT key:
      // - clearVirusTotalKey === true => null
      // - virusTotalApiKey non-empty string => encrypt and set
      // - otherwise (not present or empty string) => leave as is (do not include the column)
      if (req.body.clearVirusTotalKey === true) {
        updates.virusTotalApiKey = null;
      } else if (
        typeof req.body.virusTotalApiKey === "string" &&
        req.body.virusTotalApiKey.trim().length > 0
      ) {
        updates.virusTotalApiKey = encryptionService.encryptApiKey(
          req.body.virusTotalApiKey.trim(),
          masterKey
        );
      }
  
      // validate a partial shape (no google key at all)
      const PartialSettings = z.object({
        userId: z.string(),
        emailNotifications: z.boolean().optional(),
        defaultExpiry: z.string().optional(),
        virusTotalApiKey: z.string().nullable().optional(),
      });
  
      const parsed = PartialSettings.parse(updates);
      const saved = await storage.updateUserSettings(userId, parsed);

      if (!saved) {
        return res.status(500).json({ message: "Failed to update settings" });
      }

      return res.json({
        emailNotifications: Boolean(saved?.emailNotifications),
        defaultExpiry: saved?.defaultExpiry ?? "1day",
        hasVirusTotalKey: Boolean(saved?.virusTotalApiKey),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to update settings:", error);
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });


  app.post("/api/scan", async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { content } = z.object({ content: z.string() }).parse(req.body);

      const local = malwareScanner.scan(content);
      const urls = extractAllUrls(content);
      const domains = extractDomains(content, urls);

      const vtKey = (process.env.VIRUSTOTAL_API_KEY || "").trim();
      const threats: string[] = [...local.threats];
      const sensitiveData: string[] = [...local.sensitiveData];
      const info: string[] = [];
      const vtResults: any[] = [];

      if (vtKey && (urls.length || domains.length)) {
        const vt = new VirusTotalService();

        for (const d of domains.slice(0, 5)) {
          try {
            const r = await vt.scanDomain(d, vtKey);
            vtResults.push({ domain: d, ...r });
            if (r.malicious || r.suspicious) {
              threats.push(`domain:${d} — ${r.positives}/${r.total} engines flagged`);
            }
          } catch (e: any) {
            info.push(`VirusTotal scan failed for domain ${d}`);
          }
        }

        for (const u of urls.slice(0, 5)) {
          try {
            const r = await vt.scanUrl(u, vtKey, {
              overallTimeoutMs: 15000,
              perRequestTimeoutMs: 6000,
              pollIntervalMs: 1200,
            });
            vtResults.push({ url: u, ...r });
            if (r.malicious || r.suspicious) {
              threats.push(`url:${u} — ${r.positives}/${r.total} engines flagged`);
            }
          } catch (e: any) {
            info.push(`VirusTotal scan failed for ${u}`);
          }
        }
      } else if (urls.length || domains.length) {
        info.push("VirusTotal not configured; network indicators were not scanned.");
      }

      const clean = threats.length === 0 && sensitiveData.length === 0;

      return res.json({
        clean,
        threats,
        sensitiveData,
        info,
        urls,
        vtResults,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      console.error(error);
      return res.status(500).json({ message: "Scan failed" });
    }
  });

  /* ----------------------------- Shareable links ----------------------------- */
  app.post("/api/pastes/:id/share", requireAuth, async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { id } = req.params;
      const { expiresAt, maxUsage } = req.body;

      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user!.id) // 👈 Use non-null assertion
        return res.status(403).json({ message: "Not authorized" });

      const token = crypto.randomBytes(32).toString("hex");
      await storage.createShareableLink({
        pasteId: id,
        token,
        createdBy: req.user!.id, // 👈 Use non-null assertion
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxUsage: maxUsage || undefined,
      });

      return res.json({
        token,
        url: `${req.protocol}://${req.get("host")}/share/${token}`,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to create shareable link" });
    }
  });

  app.get("/api/share/:token", async (req: Request, res: Response) => { // 👈 Use proper types
    try {
      const { token } = req.params;
      const { password } = req.query;

      const link = await storage.getShareableLink(token);
      if (!link) return res.status(404).json({ message: "Link not found" });

      if (link.expiresAt && link.expiresAt < new Date())
        return res.status(404).json({ message: "Link has expired" });

      if (link.maxUsage && (link.usageCount || 0) >= link.maxUsage)
        return res.status(404).json({ message: "Link usage limit exceeded" });

      const paste = await storage.getPaste(link.pasteId);
      if (!paste) return res.status(404).json({ message: "Paste not found" });

      await storage.incrementLinkUsage(token);

      let content = paste.content;
      if (paste.encrypted) {
        if (!password) {
          return res
            .status(401)
            .json({ message: "Password required for encrypted paste" });
        }
        try {
          content = encryptionService.decrypt(paste.content, String(password));
        } catch {
          return res.status(401).json({ message: "Invalid password" });
        }
      }

      return res.json({
        id: paste.id,
        title: paste.title,
        content,
        language: paste.language,
        createdAt: paste.createdAt,
        encrypted: paste.encrypted,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to access shared paste" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
