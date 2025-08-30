import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { malwareScanner } from "./services/malware-scanner";
import { encryptionService } from "./services/encryption";
import { VirusTotalService } from "./services/virustotal";
import crypto from "crypto";
import {
  insertPasteSchema,
} from "@shared/schema";
import { z } from "zod";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
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

function getClientIP(req: any): string {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
    "0.0.0.0"
  );
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

 /* --------------------------- Create paste --------------------------- */
app.post("/api/pastes", async (req, res) => {
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
    const domains = extractDomains(pasteData.content, urls); // <-- add this

    // Filter out URL-only notices from local scan; VT decides URL risk
    const filteredLocalThreats = Array.isArray(local.threats)
      ? local.threats.filter((t: string) => !/^\s*URL\b/i.test(t))
      : [];

    // Info notes (non-blocking hints)
    const infoNotes: string[] = urls.length
      ? [`${urls.length} URL${urls.length > 1 ? "s" : ""} detected in content`]
      : [];

    // Respect `force` to override blocking on findings
    const force = Boolean(req.body?.force ?? false);
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
      const settings = await storage.getUserSettings(req.user?.id || "");
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
      ownerId: req.user?.id || null,
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
  app.get("/api/my-pastes", requireAuth, async (req, res) => {
    try {
      const pastes = await storage.getUserPastes(req.user?.id || "");
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
  app.delete("/api/pastes/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user?.id) {
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
  app.get("/api/pastes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.query;

      const paste = await storage.getPaste(id);
      if (!paste) {
        return res.status(404).json({ message: "Paste not found" });
      }

      // log access
      await storage.createAccessLog({
        pasteId: id,
        viewerIp: getClientIP(req),
        userAgent: req.get("User-Agent") || "",
      });

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
  app.get("/api/pastes/:id/logs", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user?.id) {
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
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
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

  app.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
  
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

  /* ----------------------- Optional direct scan endpoint ----------------------- */
  // app.post("/api/scan", async (req, res) => {
  //   try {
  //     const { content } = z.object({ content: z.string() }).parse(req.body);
  //     const report = malwareScanner.scan(content);
  //     return res.json(report);
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ message: "Invalid input" });
  //     }
  //     console.error(error);
  //     return res.status(500).json({ message: "Scan failed" });
  //   }
  // });
  
  // app.post("/api/scan", async (req, res) => {
  //   try {
  //     const { content } = z.object({ content: z.string() }).parse(req.body);

  //     const local = malwareScanner.scan(content);
  //     const urls = extractAllUrls(content);
  //     const domains = extractDomains(content, urls);

  //     const vtKey = (process.env.VIRUSTOTAL_API_KEY || "").trim();
  //     const threats: string[] = [...local.threats];
  //     const sensitiveData: string[] = [...local.sensitiveData];

  //     if (vtKey && (urls.length || domains.length)) {
  //       const vt = new VirusTotalService();

  //       // Domains first (matches VT UI domain reputation)
  //       for (const d of domains.slice(0, 5)) {
  //         try {
  //           const r = await vt.scanDomain(d, vtKey);
  //           if (r.malicious || r.suspicious) {
  //             threats.push(`domain:${d} — ${r.positives}/${r.total} engines flagged`);
  //           }
  //         } catch (e: any) {
  //           threats.push(`domain:${d} — vt_error:${e?.message ?? e}`);
  //         }
  //       }

  //       // Then URLs
  //       for (const u of urls.slice(0, 5)) {
  //         try {
  //           const r = await vt.scanUrl(u, vtKey, {
  //             overallTimeoutMs: 15000,
  //             perRequestTimeoutMs: 6000,
  //             pollIntervalMs: 1200,
  //           });
  //           if (r.malicious || r.suspicious) {
  //             threats.push(`url:${u} — ${r.positives}/${r.total} engines flagged`);
  //           }
  //         } catch (e: any) {
  //           threats.push(`url:${u} — vt_error:${e?.message ?? e}`);
  //         }
  //       }
  //     } else if (urls.length || domains.length) {
  //       threats.push("vt_info: VirusTotal not configured; network indicators were not scanned");
  //     }

  //     const clean = threats.length === 0 && sensitiveData.length === 0;
  //     return res.json({ clean, threats, sensitiveData });
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ message: "Invalid input" });
  //     }
  //     console.error(error);
  //     return res.status(500).json({ message: "Scan failed" });
  //   }
  // });

  app.post("/api/scan", async (req, res) => {
    try {
      const { content } = z.object({ content: z.string() }).parse(req.body);

      const local = malwareScanner.scan(content);
      const urls = extractAllUrls(content);
      const domains = extractDomains(content, urls);

      const vtKey = (process.env.VIRUSTOTAL_API_KEY || "").trim();
      const threats: string[] = [...local.threats];
      const sensitiveData: string[] = [...local.sensitiveData];
      const info: string[] = [];           // <-- add this
      const vtResults: any[] = [];         // <-- optional but handy

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
            info.push(`VirusTotal scan failed for domain ${d}`); // <-- info, not threat
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
            info.push(`VirusTotal scan failed for ${u}`);        // <-- info, not threat
          }
        }
      } else if (urls.length || domains.length) {
        info.push("VirusTotal not configured; network indicators were not scanned."); // <-- info, not threat
      }

      const clean = threats.length === 0 && sensitiveData.length === 0;

      return res.json({
        clean,
        threats,
        sensitiveData,
        info,               // <-- return info separately
        urls,
        vtResults,          // <-- optional
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
  app.post("/api/pastes/:id/share", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { expiresAt, maxUsage } = req.body;

      const paste = await storage.getPaste(id);
      if (!paste) return res.status(404).json({ message: "Paste not found" });
      if (paste.ownerId !== req.user?.id)
        return res.status(403).json({ message: "Not authorized" });

      const token = crypto.randomBytes(32).toString("hex");
      await storage.createShareableLink({
        pasteId: id,
        token,
        createdBy: req.user?.id || "",
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

  app.get("/api/share/:token", async (req, res) => {
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

      await storage.createAccessLog({
        pasteId: link.pasteId,
        viewerIp: getClientIP(req),
        userAgent: req.get("User-Agent") || "",
      });
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