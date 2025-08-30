import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Navigation } from "@/components/navigation";
import { PasteDisplay } from "@/components/paste-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lock, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const { data: paste, isLoading, error, refetch } = useQuery<PasteData>({
    queryKey: ["/api/pastes", pasteId, password ? "with-pass" : "no-pass"],
    queryFn: async () => {
      const url = password
        ? `/api/pastes/${pasteId}?password=${encodeURIComponent(password)}`
        : `/api/pastes/${pasteId}`;

      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" }, // ask for JSON explicitly
      });

      // Handle explicit auth required (password or login)
      if (res.status === 401) {
        // Try to read JSON error; if not JSON, still raise a clean message
        let message = "Unauthorized";
        try {
          const err = await res.clone().json();
          if (err?.message?.includes("Password required")) {
            setRequiresPassword(true);
            throw new Error("Password required");
          }
          message = err?.message || message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      // If server redirected (e.g., to /login) the final response may be HTML
      if (res.redirected || /\/login/i.test(res.url)) {
        throw new Error("Not authenticated (received a redirect to login).");
      }

      // Non-OK statuses → try to surface a useful message
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const err = await res.json().catch(() => ({} as any));
          throw new Error(err?.message || `Request failed: ${res.status} ${res.statusText}`);
        } else {
          const text = await res.text().catch(() => "");
          throw new Error(`Request failed (${res.status}). Received non-JSON response.`);
        }
      }

      // OK path — ensure response is JSON before parsing
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        // Read a tiny snippet to help debugging without spamming UI
        const snippet = (await res.text().catch(() => "")).slice(0, 120);
        throw new Error("Expected JSON but got non-JSON (possibly HTML). Check API route/proxy.");
      }

      setRequiresPassword(false);
      return await res.json();
    },
    enabled: !!pasteId,
    retry: false,
  });

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Password Required</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                This paste is encrypted and requires a password to view.
              </p>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
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

      {isLoading ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      ) : error && (error as Error).message !== "Password required" ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Error loading paste: {(error as Error).message}
            </AlertDescription>
          </Alert>
        </div>
      ) : paste ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PasteDisplay paste={paste} />
        </div>
      ) : null}
    </div>
  );
}