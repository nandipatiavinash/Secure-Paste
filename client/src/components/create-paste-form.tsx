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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  urls?: string[];
  vtResults?: any[];
  info?: string[];
}

interface CreatePasteResponse {
  id: string;
  scanResult: string;
  threats: string[];
  sensitiveData: string[];
}

/** Simple client-side credential / secret detector (fast heuristics) */
function detectCredentials(text: string): string[] {
  const hits: string[] = [];
  const RX = {
    email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    jwt: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+(?:\.[A-Za-z0-9-_.+/=]+)?\b/g,
    stripeTest: /\bsk_test_[A-Za-z0-9]{24,}\b/g,
    stripeLive: /\bsk_live_[A-Za-z0-9]{24,}\b/g,
    awsKey: /\bAKIA[0-9A-Z]{16}\b/g,
    googleApi: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    creditCard:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    rsaKey: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  } as const;

  if (RX.email.test(text)) hits.push("Email address");
  if (RX.jwt.test(text)) hits.push("JWT-like token");
  if (RX.stripeLive.test(text)) hits.push("Stripe live secret key");
  if (RX.stripeTest.test(text)) hits.push("Stripe test secret key");
  if (RX.awsKey.test(text)) hits.push("AWS access key");
  if (RX.googleApi.test(text)) hits.push("Google API key");
  if (RX.creditCard.test(text)) hits.push("Credit card number");
  if (RX.rsaKey.test(text)) hits.push("Private key material");
  return hits;
}

/** Extract URLs (client-side) */
function extractAllUrls(text: string): string[] {
  const matches = text.match(/\bhttps?:\/\/[^\s)]+/gi) || [];
  const cleaned = matches.map((u) => u.replace(/[),.;]+$/g, ""));
  return Array.from(new Set(cleaned));
}

export function CreatePasteForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const [lastCreateData, setLastCreateData] = useState<FormData | null>(null);
  const debounceRef = useRef<number | null>(null);

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

  // ---- server scan mutation ----
  const scanMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/scan", { content });
      if (!res.ok) throw res;
      return res.json();
    },
    onSuccess: (result: any) => {
      setScanResult({
        clean: Boolean(result.clean),
        threats: result.threats || [],
        sensitiveData: result.sensitiveData || [],
        urls: result.urls || [],
        vtResults: result.vtResults || [],
        info: result.info || [],
      });
    },
    onError: () => {
      toast({
        title: "Scan failed",
        description: "Unable to scan content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---- create mutation ----
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/pastes", payload);
      // propagate non-2xx so caller can handle 422
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        const err: any = new Error("Create failed");
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return res.json();
    },
    onSuccess: (result: CreatePasteResponse) => {
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
      // special-case 422 (flagged) -> show confirm to force
      if (err?.status === 422 && err?.body) {
        // preserve last create payload so user can "force" create
        setForceConfirmOpen(true);
        toast({
          title: "Security scan flagged content",
          description: err.body?.message || "Flagged by server",
          variant: "destructive",
        });
        // also bring server-provided details into UI if available
        try {
          const serverVt = err.body?.vtResults;
          const serverThreats = err.body?.threats;
          const serverSensitive = err.body?.sensitiveData;
          setScanResult((prev) => ({
            clean: false,
            threats: serverThreats || prev?.threats || [],
            sensitiveData: serverSensitive || prev?.sensitiveData || [],
            urls: prev?.urls || [],
            vtResults: serverVt || prev?.vtResults || [],
            info: prev?.info || [],
          }));
        } catch {}
        return;
      }

      toast({
        title: "Failed to create paste",
        description: err?.body?.message || err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---- debounced auto-scan (client + server only when needed) ----
  useEffect(() => {
    const content = form.getValues("content") || "";

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!content.trim()) {
      setScanResult(null);
      return;
    }

    // quick client detection
    const clientFindings = detectCredentials(content);
    const urls = extractAllUrls(content);

    if (clientFindings.length > 0) {
      setScanResult((prev) => ({
        clean: false,
        threats: prev?.threats ?? [],
        sensitiveData: clientFindings,
        urls: prev?.urls ?? urls,
        vtResults: prev?.vtResults ?? [],
        info: prev?.info ?? [],
      }));
    }

    // decide if we should call server: only if we have urls or credential hits
    if (clientFindings.length === 0 && urls.length === 0) {
      return;
    }

    // debounce server scan
    debounceRef.current = window.setTimeout(() => {
      scanMutation.mutate(content);
    }, 700);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("content")]);

  // ---- manual scan button ----
  const handleScan = () => {
    const content = form.getValues("content");
    if (!content.trim()) {
      toast({ title: "No content", description: "Enter content to scan.", variant: "destructive" });
      return;
    }
    scanMutation.mutate(content);
  };

  // ---- on submit ----
  const onSubmit = (data: FormData) => {
    // require password if encrypted asked
    if (data.encrypted && !data.password) {
      toast({ title: "Password required", description: "Please provide a password for encryption.", variant: "destructive" });
      return;
    }

    // store last data so we can resend with force if needed
    setLastCreateData(data);

    // If scan result exists and flagged, ask for confirm (client-side)
    if (scanResult && (!scanResult.clean || (scanResult.sensitiveData?.length || 0) > 0)) {
      const proceed = window.confirm(
        `Security scan flagged possible issues (${(scanResult.threats?.length || 0) + (scanResult.sensitiveData?.length || 0)}). Click OK to attempt create (server may still block).`
      );
      if (!proceed) return;
    }

    createMutation.mutate(data);
  };

  // ---- force-create after server 422 ----
  const handleForceCreate = () => {
    if (!lastCreateData) {
      toast({ title: "No previous data", description: "Try submitting again first.", variant: "destructive" });
      return;
    }
    setForceConfirmOpen(false);
    const payload = { ...lastCreateData, force: true };
    createMutation.mutate(payload);
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
              {/* title */}
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a title..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* content */}
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea placeholder="Paste here..." className="h-64 font-mono text-sm resize-none" {...field} />
                      <div className="absolute bottom-2 right-2 text-xs text-slate-500">{(field.value || "").length} characters</div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* options */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-slate-700">Security Options</Label>
                  <div className="space-y-3">
                    <FormField control={form.control} name="encrypted" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value || false} onCheckedChange={(checked) => { field.onChange(checked); setShowPassword(!!checked); }} />
                        </FormControl>
                        <FormLabel className="text-sm text-slate-700">Encrypt with password</FormLabel>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="selfDestruct" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl><Checkbox checked={field.value || false} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm text-slate-700">Self-destruct after first view</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <FormField control={form.control} name="expiryTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Settings</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select expiry" /></SelectTrigger>
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
                )} />
              </div>

              {(encrypted || showPassword) && (
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Encryption Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter strong password" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>Language (for syntax highlighting)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "plaintext"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="plaintext">Plain Text</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="css">CSS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Scan results */}
              {scanResult && (
                <Alert className={scanResult.clean ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
                  <div className="flex items-center space-x-2">
                    {scanResult.clean ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={`font-medium ${scanResult.clean ? "text-green-700" : "text-amber-700"}`}>
                      Security scan {scanResult.clean ? "passed" : "flagged content"}
                    </span>
                  </div>

                  <AlertDescription className={scanResult.clean ? "text-green-600" : "text-amber-600"}>
                    {scanResult.clean ? (
                      "No malicious content or sensitive data patterns detected."
                    ) : (
                      <>
                        {scanResult.threats?.length ? <div><strong>Threats:</strong> {scanResult.threats.join(", ")}</div> : null}
                        {scanResult.sensitiveData?.length ? <div><strong>Sensitive matches:</strong> {scanResult.sensitiveData.join(", ")}</div> : null}
                        {scanResult.urls?.length ? (
                          <div>
                            <strong>Found URLs:</strong>
                            <ul className="list-disc ml-6">
                              {scanResult.urls.map((u) => {
                                const vt = (scanResult.vtResults || []).find((r: any) => r.url === u || r.domain === u);
                                return (
                                  <li key={u}>
                                    {u}
                                    {vt ? (
                                      <span className="ml-2 text-sm">— {vt.malicious ? `malicious (${vt.positives}/${vt.total})` : vt.suspicious ? `suspicious (${vt.positives}/${vt.total})` : 'clean'}</span>
                                    ) : (
                                      <span className="ml-2 text-sm text-slate-500"> — VT: unknown / not scanned</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

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
      </div>

      {/* Simple confirm UI for forcing create after server 422 */}
      {forceConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Server flagged content</h3>
            <p className="text-sm mb-4">The server has flagged this content as sensitive or potentially unsafe. You can force creation if you understand the risk.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForceConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleForceCreate}>Create anyway</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
