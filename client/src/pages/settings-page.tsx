// client/src/pages/settings-page.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Shield, Key, Bell, Clock } from "lucide-react";

const settingsSchema = z.object({
  virusTotalApiKey: z.string().optional(),
  emailNotifications: z.boolean().default(true),
  defaultExpiry: z.enum(["1h", "1d", "1w", "1m", "never"]).default("1d"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

type SettingsResponse = {
  emailNotifications: boolean;
  defaultExpiry: string;
  hasVirusTotalKey: boolean;
};

const MASK = "••••••••••••••••";

export default function SettingsPage() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch server settings
  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  // react-hook-form
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      virusTotalApiKey: "",
      emailNotifications: true,
      defaultExpiry: "1d",
    },
    // If settings are loaded, initialize the form values with them (keeps it responsive)
    values: settings
      ? {
          virusTotalApiKey: settings.hasVirusTotalKey ? MASK : "",
          emailNotifications: settings.emailNotifications ?? true,
          defaultExpiry:
            (settings.defaultExpiry as SettingsFormData["defaultExpiry"]) ??
            "1d",
        }
      : undefined,
  });

  const hasStoredKey = !!settings?.hasVirusTotalKey;
  const isMasked =
    hasStoredKey && form.getValues("virusTotalApiKey") === MASK;

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData & { clearVirusTotalKey?: boolean }) => {
      const updateData: any = { ...data };

      // don't send the mask as the real key
      if (updateData.virusTotalApiKey === MASK) {
        delete updateData.virusTotalApiKey;
      }

      const res = await apiRequest("PUT", "/api/settings", updateData);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error?.message || "Unable to save settings.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const removeApiKey = () => {
    updateSettingsMutation.mutate({
      ...form.getValues(),
      virusTotalApiKey: "",
      clearVirusTotalKey: true,
    });
  };

  const startReplace = () => {
    form.setValue("virusTotalApiKey", "");
    setShowApiKey(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-7 h-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Security & Scanning */}
            <Card className="mx-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Shield className="w-4 h-4" />
                  <span>Security & Scanning</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="virusTotalApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
                        <div className="flex-1">
                          <FormLabel className="flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            <span>VirusTotal API Key</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showApiKey ? "text" : "password"}
                                placeholder={
                                  isMasked
                                    ? "Key is saved — click Replace to enter new one"
                                    : "Enter your VirusTotal API key"
                                }
                                {...field}
                                value={field.value || ""}
                                readOnly={isMasked}
                                autoComplete="off"
                                className="pr-24" /* leave space for action buttons on small screens */
                              />
                              {/* action buttons: positioned inside input area on small screens */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                                {!isMasked && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowApiKey((v) => !v)}
                                  >
                                    {showApiKey ? "Hide" : "Show"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </FormControl>

                          <FormDescription className="mt-2 block text-sm">
                            Get your free API key from{" "}
                            <a
                              href="https://www.virustotal.com/gui/join-us"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              VirusTotal
                            </a>
                            . This enables real-time malware scanning.
                          </FormDescription>
                          <FormMessage />
                        </div>

                        {/* Buttons stack on small screens below the input */}
                        <div className="mt-3 sm:mt-0 sm:flex sm:flex-col sm:justify-start sm:gap-2">
                          {isMasked ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={startReplace}
                              >
                                Replace key
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={removeApiKey}
                              >
                                Remove key
                              </Button>
                            </>
                          ) : settings?.hasVirusTotalKey ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={removeApiKey}
                            >
                              Remove key
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card className="mx-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <SettingsIcon className="w-4 h-4" />
                  <span>Preferences</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 gap-3">
                      <div>
                        <FormLabel className="flex items-center gap-2">
                          <Bell className="w-4 h-4" />
                          <span>Email Notifications</span>
                        </FormLabel>
                        <FormDescription className="text-sm">
                          Receive email alerts for paste expiry and security events
                        </FormDescription>
                      </div>
                      <FormControl className="self-start sm:self-center">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Default Paste Expiry</span>
                      </FormLabel>

                      <div className="mt-2 sm:mt-0 max-w-xs">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select expiry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1h">1 Hour</SelectItem>
                            <SelectItem value="1d">1 Day</SelectItem>
                            <SelectItem value="1w">1 Week</SelectItem>
                            <SelectItem value="1m">1 Month</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="mt-2 text-sm">
                          New pastes will use this expiry setting by default.
                        </FormDescription>
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="w-full sm:w-40"
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
