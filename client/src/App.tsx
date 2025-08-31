import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import HomePage from "@/pages/home-page";
import CreatePage from "@/pages/create-page";
import AuthPage from "@/pages/auth-page";
import PasteView from "@/pages/paste-view";
import PasteSuccessPage from "@/pages/paste-success";
import AccessLogsPage from "@/pages/access-logs";
import Dashboard from "@/pages/dashboard";
import SettingsPage from "@/pages/settings-page";
import SharePage from "@/pages/share-page";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/create" component={CreatePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/paste/:id/success" component={PasteSuccessPage} />
      <Route path="/paste/:id/logs" component={AccessLogsPage} />
      <Route path="/paste/:id" component={PasteView} />
      <Route path="/share/:token" component={SharePage} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
