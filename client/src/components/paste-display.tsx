import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy, Download, Link2, Lock, Eye, Shield, AlertTriangle, Activity } from "lucide-react";
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

interface PasteDisplayProps {
  paste: PasteData;
  requiresPassword?: boolean;
  onPasswordSubmit?: (password: string) => void;
}

export function PasteDisplay({ paste, requiresPassword, onPasswordSubmit }: PasteDisplayProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(paste.content);
      toast({
        title: "Copied to clipboard",
        description: "The paste content has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy content to clipboard.",
        variant: "destructive",
      });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "The paste link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const downloadContent = () => {
    const blob = new Blob([paste.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = paste.title || `paste-${paste.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

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
              />
            </div>
            <Button 
              onClick={() => onPasswordSubmit?.(password)}
              className="w-full"
              disabled={!password.trim()}
            >
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
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {paste.title || 'Untitled Paste'}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
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
                {paste.selfDestruct && (
                  <Badge variant="destructive">
                    Self-Destruct
                  </Badge>
                )}
                <Badge variant={paste.scanStatus === 'clean' ? 'default' : 'destructive'}>
                  {paste.scanStatus === 'clean' ? (
                    <Shield className="w-3 h-3 mr-1" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 mr-1" />
                  )}
                  {paste.scanStatus === 'clean' ? 'Scan Passed' : 'Flagged'}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={copyLink}>
                <Link2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadContent}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-4 right-4 z-10">
            <Button onClick={copyToClipboard} variant="secondary" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
          <pre className="p-6 text-sm font-mono bg-slate-900 text-slate-100 overflow-x-auto">
            <code>{paste.content}</code>
          </pre>
        </div>

        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-6 text-sm text-slate-600">
              <span>
                Expires: <strong>{paste.expiresAt ? formatDate(paste.expiresAt) : 'Never'}</strong>
              </span>
              <span>
                Views: <strong>{paste.viewCount}</strong>
              </span>
              <span>
                Owner: <strong>{paste.isOwner ? 'You' : 'Anonymous'}</strong>
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
              {paste.scanStatus === 'clean' ? (
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
        </div>
      </Card>
    </div>
  );
}
