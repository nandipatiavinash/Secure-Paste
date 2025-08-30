import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Search, 
  Eye, 
  Link2, 
  BarChart3, 
  Trash2, 
  Lock, 
  Flame, 
  Shield, 
  AlertTriangle 
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Paste {
  id: string;
  title?: string;
  language: string;
  viewCount: number;
  createdAt: string;
  expiresAt?: string;
  encrypted: boolean;
  selfDestruct: boolean;
  scanStatus: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: pastes = [], isLoading, error } = useQuery<Paste[]>({
    queryKey: ["/api/my-pastes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (pasteId: string) => {
      await apiRequest("DELETE", `/api/pastes/${pasteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-pastes"] });
      toast({
        title: "Paste deleted",
        description: "The paste has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete the paste. Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyLink = async (pasteId: string) => {
    try {
      const url = `${window.location.origin}/paste/${pasteId}`;
      await navigator.clipboard.writeText(url);
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

  const filteredPastes = pastes.filter(paste => {
    const matchesSearch = !searchTerm || 
      (paste.title?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      paste.language.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === "all" ||
      (filter === "encrypted" && paste.encrypted) ||
      (filter === "expiring" && paste.expiresAt && new Date(paste.expiresAt) > new Date()) ||
      (filter === "self-destruct" && paste.selfDestruct);
    
    return matchesSearch && matchesFilter;
  });

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return "Never";
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    if (expiryDate < now) return "Expired";
    return formatDistanceToNow(expiryDate);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Pastes</h1>
          <p className="text-slate-600">Manage and monitor your secure pastes</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search pastes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pastes</SelectItem>
                <SelectItem value="encrypted">Encrypted</SelectItem>
                <SelectItem value="expiring">Expiring soon</SelectItem>
                <SelectItem value="self-destruct">Self-destruct</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/">
              <Plus className="w-4 h-4 mr-2" />
              New Paste
            </Link>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="text-slate-500">Loading pastes...</div>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load pastes. Please try again.
            </AlertDescription>
          </Alert>
        ) : filteredPastes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-slate-500 mb-4">
                {pastes.length === 0 
                  ? "You haven't created any pastes yet."
                  : "No pastes match your search criteria."
                }
              </div>
              {pastes.length === 0 && (
                <Button asChild>
                  <Link href="/">Create Your First Paste</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPastes.map((paste) => (
                  <TableRow key={paste.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">
                          {paste.title || "Untitled Paste"}
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatDistanceToNow(new Date(paste.createdAt))} ago
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">{paste.language}</Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {paste.encrypted && (
                          <Badge variant="secondary">
                            <Lock className="w-3 h-3 mr-1" />
                            Encrypted
                          </Badge>
                        )}
                        {paste.selfDestruct && (
                          <Badge variant="destructive">
                            <Flame className="w-3 h-3 mr-1" />
                            Self-destruct
                          </Badge>
                        )}
                        <Badge variant={paste.scanStatus === 'clean' ? 'default' : 'destructive'}>
                          {paste.scanStatus === 'clean' ? (
                            <Shield className="w-3 h-3 mr-1" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 mr-1" />
                          )}
                          {paste.scanStatus === 'clean' ? 'Clean' : 'Flagged'}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-slate-900">
                      {paste.viewCount}
                    </TableCell>
                    
                    <TableCell className="text-slate-900">
                      {formatExpiry(paste.expiresAt)}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/paste/${paste.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyLink(paste.id)}
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(paste.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
