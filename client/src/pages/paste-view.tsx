// client/src/pages/paste-view.tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Navigation } from "@/components/navigation";
import { PasteDisplay } from "@/components/paste-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/utils";

interface PasteData {
  id: string;
  content: string;
  title?: string;
  language: string;
  viewCount: number;
  createdAt: string;
  expiresAt?: string;
  encrypted: boolean;
  selfDestruct: boolean;
  scanStatus: string;
  isOwner: boolean;
}

export default function PasteView() {
  const { toast } = useToast();
  const [, params] = useRoute("/paste/:id");
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);

  const pasteId = params?.id;

  // Query key
  const queryKey = ["pastes", pasteId, password ? "with-pass" : "no-pass"];

  const fetchPaste = async (): Promise<PasteData> => {
    if (!pasteId) throw new Error("Missing paste id");

    const url = password
      ? `/api/pastes/${pasteId}?password=${encodeURIComponent(password)}`
      : `/api/pastes/${pasteId}`;

    const res = await fetch(`${API_URL}${url}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    // 401 handling (password required or not authenticated)
    if (res.status === 401) {
      try {
        const err = await res.clone().json();
        if (typeof err?.message === "string" && err.message.toLowerCase().includes("password")) {
          setRequiresPassword(true);
          throw new Error("Password required");
        }
        throw new Error(err?.message || "Unauthorized");
      } catch {
        setRequiresPassword(true);
        throw new Error("Password required");
      }
    }

    // Detect redirected login or HTML responses
    if (res.redirected || /\/login/i.test(res.url)) {
      throw new Error("Not authenticated (received a redirect to login).");
    }

    if (!res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const errBody = await res.json().catch(() => ({} as any));
        throw new Error(errBody?.message || `Request failed: ${res.status}`);
      } else {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}). API returned non-JSON: "${text.slice(0, 120)}"`);
      }
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const snippet = (await res.text().catch(() => "")).slice(0, 120);
      throw new Error("Expected JSON but got non-JSON response. Snippet: " + snippet);
    }

    setRequiresPassword(false);
    return await res.json();
  };

  const { data: paste, isLoading, error, refetch } = useQuery<PasteData, Error>({
    queryKey,
    queryFn: fetchPaste,
    enabled: !!pasteId,
    retry: false,
  });

  useEffect(() => {
    if (error) {
      const msg = error?.message || "Failed to load paste";
      if (msg !== "Password required") {
        toast({
          title: "Could not load paste",
          description: msg,
          variant: "destructive",
        });
      }
    }
  }, [error, toast]);

  // Ensure server receives an explicit view event (helps when GET might be cached)
  useEffect(() => {
    if (!pasteId) return;

    // Fire-and-forget; server will best-effort record the view
    fetch(`${API_URL}/api/pastes/${pasteId}/view`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) console.warn(`[view endpoint] non-OK status: ${res.status}`);
        else console.debug("[view endpoint] success", pasteId);
      })
      .catch((err) => {
        console.warn("[view endpoint] failed", err);
      });
  }, [pasteId]);

  const handlePasswordSubmit = () => {
    if (password.trim()) {
      refetch();
    }
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

  if (requiresPassword && !paste) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Password Required</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">This paste is encrypted and requires a password to view.</p>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                  className="w-full"
                />
                <Button
                  onClick={handlePasswordSubmit}
                  className="w-full"
                  disabled={!password.trim() || isLoading}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {isLoading ? "Verifying..." : "View Paste"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      {/* Loading state */}
      {isLoading ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full sm:w-96" />
            </div>
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      ) : error && (error as Error).message !== "Password required" ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error loading paste: {(error as Error).message}</AlertDescription>
          </Alert>
        </div>
      ) : paste ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* PasteDisplay should itself be responsive — ensure it uses w-full / overflow where needed */}
          <div className="w-full">
            <PasteDisplay paste={paste} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
