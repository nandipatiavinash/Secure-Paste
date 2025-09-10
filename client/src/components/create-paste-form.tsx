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

  // ---- helper to extract URLs (simple) ----
  function extractAllUrls(text: string): string[] {
    const matches = text.match(/\bhttps?:\/\/[^\s)]+/gi) || [];
    const cleaned = matches.map((u) => u.replace(/[),.;]+$/g, ""));
    return Array.from(new Set(cleaned));
  }

  // ---- scan mutation (calls server /api/scan which runs VT + local heuristics) ----
  const scanMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/scan", { content });
      // ensure we return parsed JSON even on 4xx/5xx (apiRequest should still return Response)
      const json = await res.json();
      if (!res.ok) throw json;
      return json;
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
    onError: (err: any) => {
      // If server returned structured scan info, show it in UI
      if (err && (err.threats || err.sensitiveData || err.info)) {
        setScanResult({
          clean: Boolean(err.clean) || false,
          threats: err.threats || [],
          sensitiveData: err.sensitiveData || [],
          urls: err.urls || [],
          vtResults: err.vtResults || [],
          info: err.info || [],
        });
        toast({
          title: "Security scan flagged content",
          description: "Server scan found possible issues. Review the results below.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Scan failed",
        description: "Unable to scan content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---- create mutation ----
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/pastes", data);
      const json = await res.json();
      if (!res.ok) {
        // throw server response JSON so onError can inspect it
        throw json;
      }
      return json as CreatePasteResponse;
    },
    onSuccess: (result: CreatePasteResponse) => {
      toast({
        title: "Paste created successfully",
        description: result.scanResult === "clean" ? "Content passed security scan" : "Content flagged by security scan",
      });
      setLocation(`/paste/${result.id}/success`);
    },
    onError: (err: any) => {
      // If server returned structured scan info, show it in UI and a sensible toast
      if (err && (err.threats || err.sensitiveData || err.message)) {
        if (err.threats || err.sensitiveData) {
          setScanResult({
            clean: Boolean(err.clean) || false,
            threats: err.threats || [],
            sensitiveData: err.sensitiveData || [],
            urls: err.urls || [],
            vtResults: err.vtResults || [],
            info: err.info || [],
          });
          toast({
            title: "Failed to create paste",
            description: err.message || "Sensitive or potentially unsafe content detected.",
            variant: "destructive",
          });
          return;
        }

        // otherwise show message
        toast({
          title: "Failed to create paste",
          description: err.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Failed to create paste",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---- debounced server scan on content change (single, clean effect) ----
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const content = form.getValues("content") || "";

    // clear previous timer
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // if empty, clear scan result and do not call server
    if (!content.trim()) {
      setScanResult(null);
      return;
    }

    // always call server scan on changes (backend is authoritative)
    debounceRef.current = window.setTimeout(() => {
      scanMutation.mutate(content);
    }, 700); // 700ms debounce

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("content")]);

  // ---- manual scan triggered by button ----
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

  // ---- on submit, require password if encryption requested ----
  const onSubmit = (data: FormData) => {
    if (data.encrypted && !data.password) {
      toast({
        title: "Password required",
        description: "Please provide a password for encrypted paste.",
        variant: "destructive",
      });
      return;
    }

    // If scanResult indicates issues, warn user before submit
    if (scanResult && (!scanResult.clean || (scanResult.sensitiveData && scanResult.sensitiveData.length > 0))) {
      const proceed = window.confirm(
        `Security scan flagged possible issues (${(scanResult.threats?.length || 0) + (scanResult.sensitiveData?.length || 0)}). Are you sure you want to create the paste?`
      );
      if (!proceed) return;
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
              {/* ... keep the rest of the form unchanged ... */}
              {/* include the same scan result UI you already have - it will now be populated by server responses */}
            </form>
          </Form>
        </div>
      </div>
    </section>
  );
}
