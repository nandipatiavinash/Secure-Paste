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
import { apiRequest } from "@/lib/queryClient";
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
        `${API_URL}/api/share/${token}${password ? `?password=${encodeURIComponent(password)}` : ''}`,
        {
          credentials: 'include',
        }
      );
      
      if (res.status === 401) {
        throw new Error("PASSWORD_REQUIRED");
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load paste");
      }
      
      return res.json();
    },
    enabled: false, // Don't auto-fetch until we have password if needed
    retry: false,
  });

  const handleViewPaste = async () => {
    try {
      await refetch();
      setShowContent(true);
    } catch (error: any) {
      if (error.message === "PASSWORD_REQUIRED") {
        toast({
          title: "Password required",
          description: "This paste is encrypted and requires a password to view.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Access failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: "Content copied to clipboard",
      });
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-64 mb-6"></div>
            <div className="h-96 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-slate-900">Shared Paste</h1>
        </div>

        {!showContent && !paste ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Access Required</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                Enter the password to view this encrypted paste:
              </p>
              
              <div className="flex space-x-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleViewPaste()}
                />
                <Button onClick={handleViewPaste}>
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
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>{paste.title || "Untitled Paste"}</span>
                    </CardTitle>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(paste.createdAt)}</span>
                      </div>
                      {paste.language && (
                        <Badge variant="secondary">{paste.language}</Badge>
                      )}
                      {paste.encrypted && (
                        <Badge variant="outline" className="border-amber-200 text-amber-700">
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
                  >
                    <Copy className="w-4 h-4 mr-2" />
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
                  className="min-h-[400px] border-0 resize-none font-mono text-sm"
                />
              </CardContent>
            </Card>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800">Security Notice</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    This paste was shared via a secure link. Always verify the source before using any code or commands.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-600 mb-2">Paste Not Found</h2>
              <p className="text-slate-500">
                This paste may have expired, been deleted, or the link is invalid.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
