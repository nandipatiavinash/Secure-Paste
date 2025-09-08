import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Shield, Eye, Calendar, FileText, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/utils";

export default function SharePage() {
  const { token } = useParams() as { token: string };
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showContent, setShowContent] = useState(false);

  const { data: paste, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/share", token],
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/share/${token}${
          password ? `?password=${encodeURIComponent(password)}` : ""
        }`,
        { credentials: "include" }
      );

      if (res.status === 401) throw new Error("PASSWORD_REQUIRED");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load paste");
      }
      return res.json();
    },
    enabled: false,
    retry: false,
  });

  const handleViewPaste = async () => {
    try {
      await refetch();
      setShowContent(true);
    } catch (error: any) {
      toast({
        title: error.message === "PASSWORD_REQUIRED" ? "Password required" : "Access failed",
        description:
          error.message === "PASSWORD_REQUIRED"
            ? "This paste is encrypted and requires a password to view."
            : error.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: "Content copied to clipboard" });
    });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-40" />
            <div className="h-64 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-6 sm:mb-8">
          <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Shared Paste
          </h1>
        </div>

        {/* Password required */}
        {!showContent && !paste ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                <span>Access Required</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600 text-sm sm:text-base">
                Enter the password to view this encrypted paste:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleViewPaste()}
                  className="flex-1"
                />
                <Button onClick={handleViewPaste} className="w-full sm:w-auto">
                  <Eye className="w-4 h-4 mr-2" />
                  View Paste
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : paste ? (
          <div className="space-y-6">
            {/* Paste Header */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <FileText className="w-5 h-5" />
                      <span>{paste.title || "Untitled Paste"}</span>
                    </CardTitle>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs sm:text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(paste.createdAt)}</span>
                      </div>
                      {paste.language && (
                        <Badge variant="secondary">{paste.language}</Badge>
                      )}
                      {paste.encrypted && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 text-amber-700"
                        >
                          <Lock className="w-3 h-3 mr-1" />
                          Encrypted
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(paste.content)}
                    className="self-start sm:self-center w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Paste Content */}
            <Card>
              <CardContent className="p-0">
                <Textarea
                  value={paste.content}
                  readOnly
                  className="min-h-[300px] sm:min-h-[400px] border-0 resize-none font-mono text-xs sm:text-sm"
                />
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm sm:text-base">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800">
                    Security Notice
                  </h3>
                  <p className="text-amber-700 mt-1">
                    This paste was shared via a secure link. Always verify the
                    source before using any code or commands.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-600 mb-2">
                Paste Not Found
              </h2>
              <p className="text-slate-500 text-sm sm:text-base">
                This paste may have expired, been deleted, or the link is
                invalid.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
