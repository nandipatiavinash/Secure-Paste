import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, MapPin, Monitor, ArrowLeft, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface AccessLog {
  id: string;
  pasteId: string;
  viewerIp: string;
  userAgent: string;
  accessedAt: string;
}

export default function AccessLogsPage() {
  const [, params] = useRoute("/paste/:id/logs");
  const pasteId = params?.id;

  const { data: logs, isLoading, error } = useQuery<AccessLog[]>({
    queryKey: ["/api/pastes", pasteId, "logs"],
    queryFn: async () => {
      const res = await fetch(`/api/pastes/${pasteId}/logs`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Failed to fetch access logs');
      }
      return await res.json();
    },
    enabled: !!pasteId,
  });

  const getBrowserInfo = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return { name: 'Chrome', color: 'bg-blue-100 text-blue-800' };
    if (userAgent.includes('Firefox')) return { name: 'Firefox', color: 'bg-orange-100 text-orange-800' };
    if (userAgent.includes('Safari')) return { name: 'Safari', color: 'bg-gray-100 text-gray-800' };
    if (userAgent.includes('Edge')) return { name: 'Edge', color: 'bg-green-100 text-green-800' };
    return { name: 'Unknown', color: 'bg-slate-100 text-slate-800' };
  };

  const getLocationInfo = (ip: string) => {
    // In a real implementation, you might use a geolocation API
    // For now, just show the IP and indicate if it's local
    if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
      return { location: 'Local Network', flag: '🏠' };
    }
    return { location: 'External', flag: '🌍' };
  };

  if (!pasteId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Alert>
            <AlertDescription>Invalid paste ID</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/paste/${pasteId}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Paste
              </Link>
            </Button>
          </div>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Access Logs</h1>
              <p className="text-slate-600">Monitor who has viewed this paste</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {logs && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Eye className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
                    <p className="text-sm text-slate-600">Total Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <MapPin className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {new Set(logs.map(log => log.viewerIp)).size}
                    </p>
                    <p className="text-sm text-slate-600">Unique IPs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Monitor className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {new Set(logs.map(log => getBrowserInfo(log.userAgent).name)).size}
                    </p>
                    <p className="text-sm text-slate-600">Browsers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Access Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Access History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border border-slate-200 rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <Alert>
                <AlertDescription>
                  Failed to load access logs. Please try again.
                </AlertDescription>
              </Alert>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-12">
                <Eye className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No views yet</h3>
                <p className="text-slate-600">This paste hasn't been viewed by anyone yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log, index) => {
                  const browser = getBrowserInfo(log.userAgent);
                  const location = getLocationInfo(log.viewerIp);
                  
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600">
                            #{logs.length - index}
                          </span>
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-slate-900">{log.viewerIp}</span>
                            <span className="text-lg">{location.flag}</span>
                            <Badge variant="secondary" className="text-xs">
                              {location.location}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-3 text-sm text-slate-600">
                            <div className="flex items-center space-x-1">
                              <Monitor className="w-3 h-3" />
                              <Badge className={`text-xs ${browser.color}`}>
                                {browser.name}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {formatDistanceToNow(new Date(log.accessedAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-8">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Security Information</h3>
                  <p className="text-sm text-blue-700">
                    Access logs are automatically collected for security monitoring. 
                    IP addresses and browser information help track unauthorized access 
                    and protect your content. Logs are retained for security purposes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}