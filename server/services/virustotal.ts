// server/services/virustotal.ts
type VTStats = {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout?: number;
};

type VTSubmitRes = { data: { id: string } };

type VTReport = {
  data: {
    id: string;
    attributes: {
      status?: "queued" | "in-progress" | "completed";
      stats: VTStats;
      results: Record<string, { category: "harmless" | "malicious" | "suspicious" | string }>;
      date: number; // seconds
    };
  };
};

export interface VirusTotalScanResult {
  clean: boolean;
  malicious: boolean;
  suspicious: boolean;
  scanId?: string;
  positives?: number;
  total?: number;
  detections?: string[];
  scanDate?: string;
}

export class VirusTotalService {
  private baseUrl = "https://www.virustotal.com/api/v3";

  // --- helpers ---
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Scan a single URL with capped polling and network timeouts.
   * @param url URL to scan
   * @param apiKey VT API key
   * @param overallTimeoutMs Total cap for submit+polling (default 12000 ms)
   * @param perRequestTimeoutMs Timeout per HTTP call (default 5000 ms)
   * @param pollIntervalMs Delay between polls (default 1000 ms)
   */
  async scanUrl(
    url: string,
    apiKey: string,
    {
      overallTimeoutMs = 12000,
      perRequestTimeoutMs = 5000,
      pollIntervalMs = 1000,
    }: { overallTimeoutMs?: number; perRequestTimeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<VirusTotalScanResult> {
    if (!apiKey) {
      throw new Error("VirusTotal API key is missing.");
    }

    const start = Date.now();

    // 1) Submit URL
    const submitRes = await this.fetchWithTimeout(
      `${this.baseUrl}/urls`,
      {
        method: "POST",
        headers: {
          "x-apikey": apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `url=${encodeURIComponent(url)}`,
      },
      perRequestTimeoutMs
    );

    if (!submitRes.ok) {
      throw new Error(`VirusTotal submit error: ${submitRes.status}`);
    }

    const submitJson = (await submitRes.json()) as VTSubmitRes;
    const analysisId = submitJson?.data?.id;
    if (!analysisId) throw new Error("VirusTotal submit: missing analysis id");

    // 2) Poll analysis until completed OR overall timeout
    let reportJson: VTReport | undefined;
    while (Date.now() - start < overallTimeoutMs) {
      const reportRes = await this.fetchWithTimeout(
        `${this.baseUrl}/analyses/${analysisId}`,
        { headers: { "x-apikey": apiKey } },
        perRequestTimeoutMs
      );

      if (!reportRes.ok) {
        throw new Error(`VirusTotal report error: ${reportRes.status}`);
      }

      reportJson = (await reportRes.json()) as VTReport;

      const status = reportJson?.data?.attributes?.status || "completed";
      if (status === "completed") break;

      await this.sleep(pollIntervalMs);
    }

    if (!reportJson) {
      // Failsafe (should not happen)
      throw new Error("VirusTotal report: no response");
    }

    const attr = reportJson.data.attributes;
    const stats = attr.stats;

    // If not completed by the timeout, treat as unknown (fail-open: not malicious, not suspicious)
    const timedOut = (attr.status && attr.status !== "completed") || !attr.results;

    const total = (Object.values(stats) as number[]).reduce((a, b) => a + b, 0);

    const result: VirusTotalScanResult = {
      // Strict: clean ONLY if no malicious & no suspicious
      clean: stats.malicious === 0 && stats.suspicious === 0,
      malicious: stats.malicious > 0,
      suspicious: stats.suspicious > 0,
      scanId: analysisId,
      positives: stats.malicious,
      total,
      detections: timedOut
        ? []
        : Object.entries(attr.results)
            .filter(([_, r]) => r.category !== "harmless")
            .map(([engine]) => engine),
      scanDate: new Date(attr.date * 1000).toISOString(),
    };

    // If VT didn't finish in time, don't block; just mark as unknown-clean-ish
    if (timedOut) {
      result.clean = true;        // treat as clean for UX (non-blocking)
      result.malicious = false;
      result.suspicious = false;
    }

    return result;
  }

  // Inside export class VirusTotalService { ... }
  async scanDomain(
    domain: string,
    apiKey: string,
    { perRequestTimeoutMs = 7000 }: { perRequestTimeoutMs?: number } = {}
  ) {
    if (!apiKey) throw new Error("VirusTotal API key is missing.");

    const res = await this.fetchWithTimeout?.(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`,
      { headers: { "x-apikey": apiKey } },
      perRequestTimeoutMs
    ) ?? await fetch(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`,
      { headers: { "x-apikey": apiKey } }
    ); // fallback if you don't have fetchWithTimeout

    if (!res.ok) {
      if (res.status === 404) {
        return { clean: true, malicious: false, suspicious: false, positives: 0, total: 0, detections: [] };
      }
      throw new Error(`VirusTotal domain error: ${res.status}`);
    }

    const json = await res.json();
    const attr = json?.data?.attributes;
    const stats = attr?.last_analysis_stats || {};
    const results = attr?.last_analysis_results || {};
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const harmless = stats.harmless ?? 0;
    const undetected = stats.undetected ?? 0;
    const total = malicious + suspicious + harmless + undetected;
    const detections = Object.entries(results)
      .filter(([, r]: any) => r?.category && r.category !== "harmless")
      .map(([engine]) => engine);

    return {
      clean: malicious === 0 && suspicious === 0,
      malicious: malicious > 0,
      suspicious: suspicious > 0,
      positives: malicious,
      total,
      detections,
      scanDate: attr?.last_analysis_date ? new Date(attr.last_analysis_date * 1000).toISOString() : undefined,
      reputation: attr?.reputation,
    };
  }

}