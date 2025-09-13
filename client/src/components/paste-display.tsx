// paste-display.tsx
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Copy,
  Download,
  Link2,
  Lock,
  Shield,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PasteData {
  id: string;
  content: string;
  title?: string | null;
  language: string;
  viewCount: number;
  createdAt: string;
  expiresAt?: string | null;
  encrypted: boolean;
  selfDestruct: boolean;
  scanStatus: string; // 'clean' | 'flagged' etc
  isOwner: boolean;
  threats?: string[] | null;
  sensitiveData?: string[] | null;
}

interface PasteDisplayProps {
  paste: PasteData;
  requiresPassword?: boolean;
  onPasswordSubmit?: (password: string) => void;
}

export function PasteDisplay({
  paste,
  requiresPassword,
  onPasswordSubmit,
}: PasteDisplayProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // small helpers
  const copyToClipboard = async (text: string, label = "content") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${label[0].toUpperCase() + label.slice(1)} copied.`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: `Unable to copy ${label}.`,
        variant: "destructive",
      });
    }
  };

  const copyLink = async () => {
    try {
      await copyToClipboard(window.location.href, "link");
    } catch {
      /* fallback handled in copyToClipboard */
    }
  };

  const downloadContent = () => {
    try {
      const blob = new Blob([paste.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = paste.title ? `${sanitizeFilename(paste.title)}.txt` : `paste-${paste.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "The paste has been downloaded.",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: "Unable to download paste content.",
        variant: "destructive",
      });
    }
  };

  function sanitizeFilename(name: string) {
    return name.replace(/[\/\\?%*:|"<>]/g, "-").slice(0, 200);
  }

  const formatDate = (dateString?: string | null) =>
    dateString ? new Date(dateString).toLocaleString() : "Never";

  const getTimeAgo = (dateString: string) => {
    const now = Date.now();
    const past = new Date(dateString).getTime();
    if (isNaN(past)) return "unknown";
    const diffMs = now - past;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  // memoize counts for rendering
  const sensitiveCount = useMemo(() => paste.sensitiveData?.length ?? 0, [paste.sensitiveData]);
  const threatCount = useMemo(() => paste.threats?.length ?? 0, [paste.threats]);

  // password prompt view
  if (requiresPassword) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Password Required</h2>
            <p className="text-slate-600">This paste is encrypted and requires a password to view.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Enter Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the paste password"
                className="mt-1"
                aria-label="Paste password"
              />
            </div>
            <Button onClick={() => onPasswordSubmit?.(password)} className="w-full" disabled={!password.trim()}>
              Decrypt Paste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Card className="overflow-hidden">
        {/* header / meta row */}
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 truncate">
                {paste.title || "Untitled Paste"}
              </h3>
              <div className="flex items-center space-x-3 text-sm text-slate-500 mt-1 flex-wrap">
                <span>{paste.language}</span>
                <span>•</span>
                <span>{getTimeAgo(paste.createdAt)}</span>
                <span>•</span>
                <span>{paste.content.length} characters</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {paste.encrypted && (
                  <Badge variant="secondary">
                    <Lock className="w-3 h-3 mr-1" />
                    Encrypted
                  </Badge>
                )}
                {paste.selfDestruct && <Badge variant="destructive">Self-Destruct</Badge>}

                <Badge variant={paste.scanStatus === "clean" ? "default" : "destructive"}>
                  {paste.scanStatus === "clean" ? (
                    <Shield className="w-3 h-3 mr-1" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 mr-1" />
                  )}
                  {paste.scanStatus === "clean" ? "Scan Passed" : "Flagged"}
                </Badge>
              </div>

              <Button variant="ghost" size="sm" onClick={copyLink} aria-label="Copy link">
                <Link2 className="w-4 h-4" />
              </Button>

              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(paste.content)} aria-label="Copy content">
                <Copy className="w-4 h-4" />
              </Button>

              <Button variant="ghost" size="sm" onClick={downloadContent} aria-label="Download content">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* content */}
        <div className="relative">
          <pre
            className="p-6 text-sm font-mono bg-slate-900 text-slate-100 overflow-x-auto whitespace-pre-wrap break-words"
            aria-live="polite"
          >
            <code>{paste.content}</code>
          </pre>
        </div>

        {/* footer: meta and flagged details */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-6 text-sm text-slate-600 flex-wrap">
              <span>
                Expires: <strong>{paste.expiresAt ? formatDate(paste.expiresAt) : "Never"}</strong>
              </span>
              <span>
                Views: <strong>{paste.viewCount}</strong>
              </span>
              <span>
                Owner: <strong>{paste.isOwner ? "You" : "Anonymous"}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {paste.isOwner && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/paste/${paste.id}/logs`}>
                    <Activity className="w-4 h-4 mr-2" />
                    Access Logs
                  </Link>
                </Button>
              )}

              {paste.scanStatus === "clean" ? (
                <div className="flex items-center text-green-600">
                  <Shield className="w-4 h-4 mr-1" />
                  <span className="text-sm">Scan passed</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Content flagged</span>
                </div>
              )}
            </div>
          </div>

          {/* flagged details panel (full width, appears below metadata) */}
          {paste.scanStatus !== "clean" && (
            <div className="mt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-red-700 mr-2" />
                    <div>
                      <h4 className="text-red-700 font-semibold">
                        Sensitive Data Detected
                      </h4>
                      <div className="text-sm text-red-800">
                        {sensitiveCount > 0
                          ? `${sensitiveCount} item${sensitiveCount === 1 ? "" : "s"} detected`
                          : "Potentially sensitive content found"}
                        {threatCount > 0 ? ` — ${threatCount} threat${threatCount === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails((s) => !s)}
                    aria-expanded={showDetails}
                    aria-controls="sensitive-details"
                    className="ml-2"
                  >
                    {showDetails ? (
                      <>
                        Hide <ChevronUp className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Show details <ChevronDown className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {showDetails && (
                  <div id="sensitive-details" className="mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-red-700 mb-1">Sensitive Data</h5>
                        <ul className="list-disc list-inside text-sm text-red-800 space-y-1 max-h-48 overflow-auto">
                          {paste.sensitiveData && paste.sensitiveData.length > 0 ? (
                            paste.sensitiveData.map((s, idx) => <li key={idx}>{s}</li>)
                          ) : (
                            <li>No specific labels available</li>
                          )}
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-red-700 mb-1">Threats</h5>
                        <ul className="list-disc list-inside text-sm text-red-800 space-y-1 max-h-48 overflow-auto">
                          {paste.threats && paste.threats.length > 0 ? (
                            paste.threats.map((t, idx) => <li key={idx}>{t}</li>)
                          ) : (
                            <li>No specific threats available</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
