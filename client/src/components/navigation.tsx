// client/src/components/navigation.tsx
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
    // close mobile menu after logout (if open)
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: logo + (desktop) nav links */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-slate-900">SecurePaste</span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center space-x-6">
              <Link
                href="/"
                className={`transition-colors ${location === "/" ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
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
          </div>

          {/* Right: actions + mobile toggle */}
          <div className="flex items-center space-x-2">
            {/* Auth buttons for md+ */}
            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/create" onClick={closeMobile}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Paste
                    </Link>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <User className="w-4 h-4 mr-2" />
                        {/* show just username before @ to keep it compact on small screens */}
                        <span className="hidden sm:inline">{user.email}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
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
            </div>

            {/* Mobile toggle (visible on small screens) */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`md:hidden transition-all duration-150 ease-in-out overflow-hidden ${
          mobileOpen ? "max-h-screen" : "max-h-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="bg-white border-t border-slate-200 px-4 py-3 space-y-3">
          <Link
            href="/"
            className={`block text-base ${location === "/" ? "text-slate-900 font-medium" : "text-slate-700"}`}
            onClick={closeMobile}
          >
            Home
          </Link>

          {user ? (
            <>
              <Link
                href="/create"
                className="block text-base text-slate-700"
                onClick={closeMobile}
              >
                New Paste
              </Link>
              <Link
                href="/dashboard"
                className={`block text-base ${location === "/dashboard" ? "text-slate-900 font-medium" : "text-slate-700"}`}
                onClick={closeMobile}
              >
                My Pastes
              </Link>

              {/* Reuse the dropdown content style for account actions, but rendered inline for mobile */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-sm text-slate-500 px-1 pb-1">Account</div>
                <Link href="/settings" className="block text-base text-slate-700" onClick={closeMobile}>
                  Settings
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    closeMobile();
                  }}
                  className="w-full text-left mt-2 text-base text-slate-700"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth" className="block text-base text-slate-700" onClick={closeMobile}>
                Sign In
              </Link>
              <Link href="/auth" className="block text-base text-slate-700" onClick={closeMobile}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
