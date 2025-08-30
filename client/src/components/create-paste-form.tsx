import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertPasteSchema } from "@shared/schema";
import { z } from "zod";

const formSchema = insertPasteSchema.extend({
  password: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ScanResult {
  clean: boolean;
  threats: string[];
  sensitiveData: string[];
}

interface CreatePasteResponse {
  id: string;
  scanResult: string;
  threats: string[];
  sensitiveData: string[];
}

export function CreatePasteForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      title: "",
      language: "plaintext",
      expiryTime: "never",
      encrypted: false,
      selfDestruct: false,
      password: "",
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/scan", { content });
      return await res.json();
    },
    onSuccess: (result: ScanResult) => {
      setScanResult(result);
    },
    onError: () => {
      toast({
        title: "Scan failed",
        description: "Unable to scan content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/pastes", data);
      return await res.json();
    },
    onSuccess: (result: CreatePasteResponse) => {
      toast({
        title: "Paste created successfully",
        description: result.scanResult === "clean" ? "Content passed security scan" : "Content flagged by security scan",
      });
      setLocation(`/paste/${result.id}/success`);
    },
    onError: () => {
      toast({
        title: "Failed to create paste",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleScan = () => {
    const content = form.getValues("content");
    if (!content.trim()) {
      toast({
        title: "No content to scan",
        description: "Please enter some content first.",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate(content);
  };

  const onSubmit = (data: FormData) => {
    if (data.encrypted && !data.password) {
      toast({
        title: "Password required",
        description: "Please provide a password for encrypted paste.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  };

  const encrypted = form.watch("encrypted");

  return (
    <section id="create-paste" className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Create Secure Paste</h2>
          <p className="text-lg text-slate-600">Share your code or text with advanced security options</p>
        </div>
        
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a title for your paste..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Textarea 
                          placeholder="Paste your code or text here..."
                          className="h-64 font-mono text-sm resize-none"
                          {...field}
                        />
                        <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                          {field.value.length} characters
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-slate-700">Security Options</Label>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="encrypted"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value || false} 
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                setShowPassword(!!checked);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm text-slate-700">Encrypt with password</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="selfDestruct"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox 
                              checked={field.value || false} 
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm text-slate-700">Self-destruct after first view</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="expiryTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Settings</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expiry time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="never">Never expire</SelectItem>
                          <SelectItem value="1h">1 hour</SelectItem>
                          <SelectItem value="1d">1 day</SelectItem>
                          <SelectItem value="1w">1 week</SelectItem>
                          <SelectItem value="1m">1 month</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {(encrypted || showPassword) && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Encryption Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter strong password for encryption"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language (for syntax highlighting)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "plaintext"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="plaintext">Plain Text</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="java">Java</SelectItem>
                        <SelectItem value="cpp">C++</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="css">CSS</SelectItem>
                        <SelectItem value="sql">SQL</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scanResult && (
                <Alert className={scanResult.clean ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
                  <div className="flex items-center space-x-2">
                    {scanResult.clean ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={`font-medium ${scanResult.clean ? 'text-green-700' : 'text-amber-700'}`}>
                      Security scan {scanResult.clean ? 'passed' : 'flagged content'}
                    </span>
                  </div>
                  <AlertDescription className={scanResult.clean ? 'text-green-600' : 'text-amber-600'}>
                    {scanResult.clean 
                      ? "No malicious content or sensitive data patterns detected."
                      : `Found ${scanResult.threats.length + scanResult.sensitiveData.length} potential issues.`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? "Creating..." : "Create Secure Paste"}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleScan}
                  disabled={scanMutation.isPending}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {scanMutation.isPending ? "Scanning..." : "Scan First"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </section>
  );
}
