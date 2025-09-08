import { Navigation } from "@/components/navigation";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import { Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navigation />
      <HeroSection />
      <FeaturesSection />

      <footer className="bg-slate-800 text-slate-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-white">SecurePaste</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Privacy-focused secure text and code sharing platform with
                built-in malware detection.
              </p>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-semibold text-white mb-4">Features</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Malware Detection
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Encryption
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Auto Expiry
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Access Logs
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security Guide
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Status Page
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Bug Reports
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-slate-700 mt-8 pt-6 text-center text-xs sm:text-sm text-slate-400">
            <p>
              &copy; {new Date().getFullYear()} SecurePaste. All rights
              reserved. Built with privacy in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
