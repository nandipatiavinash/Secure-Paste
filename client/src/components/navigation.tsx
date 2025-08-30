import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Shield, Menu, LogOut, User, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-slate-900">SecurePaste</span>
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link 
                href="/" 
                className={`transition-colors ${location === '/' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Home
              </Link>
              {user && (
                <Link 
                  href="/dashboard" 
                  className={`transition-colors ${location === '/dashboard' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  My Pastes
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
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
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
