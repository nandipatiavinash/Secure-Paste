import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, LogOut, User, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-slate-900">SecurePaste</span>
            </Link>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className={`transition-colors ${
                location === "/" ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Home
            </Link>
            {user && (
              <Link
                href="/dashboard"
                className={`transition-colors ${
                  location === "/dashboard" ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Pastes
              </Link>
            )}
          </div>

          {/* Right side (buttons + mobile toggle) */}
          <div className="flex items-center space-x-4">
            {/* Auth Buttons */}
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/create">
                    <Plus className="w-4 h-4 mr-2" />
                    New Paste
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <User className="w-4 h-4 mr-2" />
                      {user.email}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">My Pastes</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth">Sign Up</Link>
                </Button>
              </>
            )}

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-2">
          <Link
            href="/"
            className={`block ${location === "/" ? "text-primary font-medium" : "text-slate-700"}`}
            onClick={() => setMobileOpen(false)}
          >
            Home
          </Link>
          {user && (
            <Link
              href="/dashboard"
              className={`block ${
                location === "/dashboard" ? "text-primary font-medium" : "text-slate-700"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              My Pastes
            </Link>
          )}
          {!user && (
            <>
              <Link href="/auth" className="block text-slate-700" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
              <Link href="/auth" className="block text-slate-700" onClick={() => setMobileOpen(false)}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
