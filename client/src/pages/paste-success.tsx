import { useState, useEffect } from "react";
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
  const pasteUrl = `${window.location.origin}/paste/${pasteId}`;

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
      
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
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
          
          <CardContent className="space-y-6">
            {/* Paste URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Paste URL
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 px-3 py-2 bg-slate-100 border rounded-lg font-mono text-sm text-slate-700 break-all">
                  {pasteUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pasteUrl)}
                  className="flex-shrink-0"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Security Features */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2 flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Security Features Active
              </h3>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    Access Logging
                  </Badge>
                  <span>All views are tracked for security</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    Auto-Expiry
                  </Badge>
                  <span>Paste will expire based on your settings</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button asChild className="flex-1">
                <Link href={`/paste/${pasteId}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Paste
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/dashboard">
                  <Share className="w-4 h-4 mr-2" />
                  My Pastes
                </Link>
              </Button>
            </div>
            
            <div className="text-center">
              <Button variant="ghost" asChild>
                <Link href="/">Create Another Paste</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}