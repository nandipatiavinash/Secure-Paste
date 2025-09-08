import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Copy, Share, Eye, Calendar, Lock } from "lucide-react";

export default function PasteSuccessPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/paste/:id/success");
  const [copied, setCopied] = useState(false);

  const pasteId = params?.id;
  // guard window in SSR contexts (if any)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pasteUrl = `${origin}/paste/${pasteId}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Paste URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (!pasteId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-xl font-semibold text-slate-600 mb-2">Invalid URL</h2>
              <p className="text-slate-500 mb-4">The paste ID is missing from the URL.</p>
              <Button asChild>
                <Link href="/">Create New Paste</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="shadow-sm">
          <CardHeader className="text-center px-6 pt-8">
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <CardTitle className="text-2xl text-slate-900">
              Paste Created Successfully!
            </CardTitle>
            <p className="text-slate-600 mt-2">
              Your paste has been created and is ready to share.
            </p>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            {/* Paste URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 block">Paste URL</label>

              <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-2 space-y-2 sm:space-y-0">
                <div
                  className="flex-1 px-3 py-2 bg-slate-100 border rounded-lg font-mono text-sm text-slate-700 break-words"
                  aria-live="polite"
                >
                  <a
                    href={pasteUrl}
                    className="underline break-words"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pasteUrl}
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 w-full sm:w-auto">
                  <Button
                    onClick={() => copyToClipboard(pasteUrl)}
                    aria-label="Copy paste URL"
                    className="w-full sm:w-auto"
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>

                  <Button
                    onClick={() => {
                      // fallback share using navigator.share if available
                      if (navigator.share) {
                        navigator
                          .share({ title: "SecurePaste", text: "View this paste", url: pasteUrl })
                          .catch(() => {
                            /* ignore share errors */
                          });
                      } else {
                        toast({
                          title: "Share",
                          description: "Use your device's native share or copy the link.",
                        });
                      }
                    }}
                    aria-label="Share paste"
                    className="w-full sm:w-auto mt-2 sm:mt-0"
                    variant="ghost"
                    size="sm"
                  >
                    <Share className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Security Features */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2 flex items-center justify-center sm:justify-start">
                <Lock className="w-4 h-4 mr-2" />
                Security Features Active
              </h3>
              <div className="space-y-2 text-sm text-blue-700 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <Badge variant="secondary" className="text-xs flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    Access Logging
                  </Badge>
                  <span>All views are tracked for security</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <Badge variant="secondary" className="text-xs flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    Auto-Expiry
                  </Badge>
                  <span>Paste will expire based on your settings</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="w-full">
                <Link href={`/paste/${pasteId}`} aria-label="View paste">
                  <Eye className="w-4 h-4 mr-2" />
                  View Paste
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard" aria-label="Go to my pastes">
                  <Share className="w-4 h-4 mr-2" />
                  My Pastes
                </Link>
              </Button>
            </div>

            <div className="text-center">
              <Button variant="ghost" asChild>
                <Link href="/" aria-label="Create another paste">Create Another Paste</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
