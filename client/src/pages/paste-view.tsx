// client/src/pages/paste-view.tsx
import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Navigation } from "@/components/navigation";
import { PasteDisplay } from "@/components/paste-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/utils";

type PasteMeta = {
  id: string;
  title?: string;
  language: string;
  encrypted: boolean;
  selfDestruct: boolean;
  createdAt?: string;
  expiresAt?: string | null;
  viewCount?: number;
};

type PasteContentResponse = {
  id: string;
  title?: string;
  language: string;
  content: string;
};

export default function PasteView() {
  const { toast } = useToast();
  const [, params] = useRoute("/paste/:id");
  const pasteId = params?.id;

  const [meta, setMeta] = useState<PasteMeta | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Load metadata only (GET /api/pastes/:id) - server must NOT return content here
  useEffect(() => {
    if (!pasteId) return;
    setLoadingMeta(true);
    setError(null);

    fetch(`${API_URL}/api/pastes/${pasteId}`, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 410) {
          throw new Error("This paste has expired or is no longer available.");
        }
        if (res.status === 404) {
          throw new Error("Paste not found.");
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(body || `Failed to load paste metadata (${res.status})`);
        }
        const json = await res.json();
        // Expect JSON metadata with encrypted/selfDestruct flags
        setMeta(json);
      })
      .catch((err) => {
        console.error("Failed to load paste metadata:", err);
        setError(err?.message || "Failed to load paste metadata.");
        toast({
          title: "Could not load paste",
          description: err?.message || "Failed to load paste metadata.",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingMeta(false));
  }, [pasteId, toast]);

  // 2) Fetch content by calling POST /api/pastes/:id/view
  async function handleViewPaste() {
    if (!pasteId) return;
    setLoadingContent(true);
    setError(null);

    try {
      const body = meta?.encrypted ? { password } : {};
      const res = await fetch(`${API_URL}/api/pastes/${pasteId}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.status === 410) {
        // expired or already self-destructed
        setContent(null);
        setMeta(null);
        throw new Error("This paste has expired or is no longer available.");
      }

      if (res.status === 401) {
        // password required
        throw new Error("Password required to view this paste.");
      }

      if (res.status === 403) {
        // wrong password
        throw new Error("Incorrect password.");
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Failed to load paste content (${res.status})`);
      }

      const json: PasteContentResponse = await res.json();
      setContent(json.content);
      try {
  const r = await fetch(`${API_URL}/api/pastes/${pasteId}`, { credentials: "include" });
  if (r.ok) {
    const updatedMeta = await r.json();
    setMeta(updatedMeta);
  }
} catch (e) {
  console.warn("Failed to refresh metadata", e);
}
      // If this was a selfDestruct paste, server should have deleted/marked it so subsequent view attempts return 410.
      // Update meta.viewCount if the server returns that; here we just keep meta for UI context.
    } catch (err: any) {
      console.error("view error:", err);
      setError(err?.message || "Failed to fetch paste content.");
      toast({
        title: "Unable to view paste",
        description: err?.message || "Failed to view paste content.",
        variant: "destructive",
      });
    } finally {
      setLoadingContent(false);
    }
  }

  // UI handlers
  const onPasswordSubmit = (e?: React.KeyboardEvent) => {
    if (e && e.key !== "Enter") return;
    handleViewPaste();
  };

  if (!pasteId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Invalid paste URL.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loadingMeta ? (
          <div className="p-6 bg-white rounded shadow">Loading paste...</div>
        ) : error && !meta ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : meta && !content ? (
          // Display password prompt if encrypted, else a simple View button
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {meta.encrypted ? <Lock className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span>{meta.title || "Untitled Paste"}</span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="mb-4 text-sm text-slate-600">
                {meta.encrypted && <div className="mb-2">This paste is encrypted and requires a password to view.</div>}
                {meta.selfDestruct && <div className="text-amber-600">This paste will be destroyed after it is viewed once.</div>}
              </div>

              {meta.encrypted ? (
                <>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onPasswordSubmit}
                    className="mb-3"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleViewPaste()} disabled={loadingContent || !password.trim()} className="flex-1">
                      {loadingContent ? "Verifying..." : "Decrypt & View"}
                    </Button>
                  </div>
                </>
              ) : (
                <Button onClick={() => handleViewPaste()} disabled={loadingContent} className="w-40">
                  {loadingContent ? "Loading..." : "View Paste"}
                </Button>
              )}

              {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            </CardContent>
          </Card>
        ) : content && meta ? (
          // Render content using your existing PasteDisplay
          <PasteDisplay paste={{ ...meta, content } as any} />
        ) : null}
      </div>
    </div>
  );
}
