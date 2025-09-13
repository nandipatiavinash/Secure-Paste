// client/src/components/create-paste-form.tsx
import { useState, useEffect, useRef } from "react";
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

// Extend schema to allow password
const formSchema = insertPasteSchema.extend({
  password: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

interface ScanResult {
  clean: boolean;
  threats: string[];
  sensitiveData: string[];
  urls?: string[];
  vtResults?: { url?: string; domain?: string; malicious?: boolean; suspicious?: boolean; positives?: number; total?: number }[];
  info?: string[];
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

  // --- Scan Mutation ---
  const scanMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/scan", { content });
      const json = await res.json();
      if (!res.ok) throw json;
      return json;
    },
    onSuccess: (result: ScanResult) => setScanResult(result),
    onError: (err: any) => {
      toast({
        title: "Scan failed",
        description: err?.message || "Unable to scan content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // --- Create Mutation ---
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/pastes", data);
      const json = await res.json();
      if (!res.ok) throw json;
      return json as CreatePasteResponse;
    },
    onSuccess: (result) => {
      toast({
        title: "Paste created successfully",
        description:
          result.scanResult === "clean"
            ? "Content passed security scan"
            : "Content flagged by security scan",
      });
      setLocation(`/paste/${result.id}/success`);
    },
    onError: (err: any) => {
      const message =
        typeof err === "string"
          ? err
          : err?.message || "Failed to create paste. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  // --- Auto scan with debounce ---
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const content = form.getValues("content");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!content.trim()) {
      setScanResult(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      scanMutation.mutate(content);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.watch("content")]);

  // --- Manual scan ---
  const handleScan = () => {
    const content = form.getValues("content");
    if (!content.trim()) {
      toast({
        title: "No content",
        description: "Please enter some content first.",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate(content);
  };

  // --- Submit handler ---
  const onSubmit = (data: FormData) => {
    if (data.encrypted && !data.password) {
      toast({
        title: "Password required",
        description: "Provide a password for encryption.",
        variant: "destructive",
      });
      return;
    }
    if (scanResult && !scanResult.clean) {
      const proceed = window.confirm(
        `Security scan flagged ${scanResult.threats.length + scanResult.sensitiveData.length
        } issue(s). Do you still want to continue?`
      );
      if (!proceed) return;
    }
    createMutation.mutate(data);
  };

  // --- UI ---
  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-2">Create Secure Paste</h2>
        <p className="text-center text-slate-600 mb-8">
          Share code or text with built-in security scans
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-slate-50 p-6 rounded-xl border">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional title" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Paste code or text here..."
                      className="h-64 font-mono text-sm resize-none"
                    />
                  </FormControl>
                  <p className="text-xs text-slate-500 mt-1">
                    {field.value.length} characters
                  </p>
                </FormItem>
              )}
            />

            {/* Security options */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Security</Label>
                <FormField
                  control={form.control}
                  name="encrypted"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(c) => {
                            field.onChange(c);
                            setShowPassword(!!c);
                          }}
                        />
                      </FormControl>
                      <FormLabel>Encrypt with password</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="selfDestruct"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Self-destruct after first view</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="expiryTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="1d">1 day</SelectItem>
                        <SelectItem value="1w">1 week</SelectItem>
                        <SelectItem value="1m">1 month</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* Password */}
            {(form.watch("encrypted") || showPassword) && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Strong password" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Language */}
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                </FormItem>
              )}
            />

            {/* Scan Result */}
            {scanResult && (
              <Alert className={scanResult.clean ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
                <div className="flex items-center space-x-2">
                  {scanResult.clean ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="font-medium">
                    {scanResult.clean ? "Scan passed" : "Content flagged"}
                  </span>
                </div>
                <AlertDescription>
                  {!scanResult.clean && (
                    <div className="mt-2 space-y-1 text-sm">
                      {scanResult.threats?.length > 0 && (
                        <div><strong>Threats:</strong> {scanResult.threats.join(", ")}</div>
                      )}
                      {scanResult.sensitiveData?.length > 0 && (
                        <div><strong>Sensitive:</strong> {scanResult.sensitiveData.join(", ")}</div>
                      )}
                      {scanResult.urls?.length > 0 && (
                        <div>
                          <strong>URLs:</strong>
                          <ul className="list-disc ml-5">
                            {scanResult.urls.map((u) => {
                              const vt = scanResult.vtResults?.find(r => r.url === u || r.domain === u);
                              return (
                                <li key={u}>
                                  {u} —{" "}
                                  {vt
                                    ? vt.malicious
                                      ? `malicious (${vt.positives}/${vt.total})`
                                      : vt.suspicious
                                      ? `suspicious (${vt.positives}/${vt.total})`
                                      : "clean"
                                    : "not scanned"}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                <Shield className="w-4 h-4 mr-2" />
                {createMutation.isPending ? "Creating..." : "Create Secure Paste"}
              </Button>
              <Button type="button" variant="outline" onClick={handleScan} disabled={scanMutation.isPending}>
                <Search className="w-4 h-4 mr-2" />
                {scanMutation.isPending ? "Scanning..." : "Scan First"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </section>
  );
}
