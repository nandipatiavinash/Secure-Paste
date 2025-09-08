import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Settings, Shield, Key, Bell, Clock } from "lucide-react";

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

  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      virusTotalApiKey: "",
      emailNotifications: true,
      defaultExpiry: "1d",
    },
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
    mutationFn: async (
      data: SettingsFormData & { clearVirusTotalKey?: boolean }
    ) => {
      const updateData: any = { ...data };

      // skip sending mask
      if (updateData.virusTotalApiKey === MASK) {
        delete updateData.virusTotalApiKey;
      }

      const res = await apiRequest("PUT", "/api/settings", updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 rounded"></div>
              <div className="h-32 bg-slate-200 rounded"></div>
            </div>
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
          <Settings className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Security & Scanning</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="virusTotalApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
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
                          />
                          {!isMasked ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2"
                              onClick={() => setShowApiKey((v) => !v)}
                            >
                              {showApiKey ? "Hide" : "Show"}
                            </Button>
                          ) : null}
                        </div>
                      </FormControl>
                      <div className="flex items-center gap-2">
                        <FormDescription>
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
                        {isMasked ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={startReplace}
                            >
                              Replace key
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
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
                            onClick={removeApiKey}
                          >
                            Remove key
                          </Button>
                        ) : null}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center space-x-2">
                          <Bell className="w-4 h-4" />
                          <span>Email Notifications</span>
                        </FormLabel>
                        <FormDescription>
                          Receive email alerts for paste expiry and security
                          events
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Default Paste Expiry</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
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
                      <FormDescription>
                        New pastes will use this expiry setting by default
                      </FormDescription>
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
                className="w-32"
              >
                {updateSettingsMutation.isPending
                  ? "Saving..."
                  : "Save Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}