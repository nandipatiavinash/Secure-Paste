import { Button } from "@/components/ui/button";
import { Shield, Plus } from "lucide-react";
import { Link } from "wouter";

export function HeroSection() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
            Secure Text & Code Sharing
            <span className="text-primary"> with Privacy First</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Share code snippets, logs, and sensitive text securely with built-in malware detection, 
            encryption, and automatic expiry. Your privacy is protected by default.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="px-8">
              <Link href="/create">
                <Plus className="w-4 h-4 mr-2" />
                Create New Paste
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link href="/auth">
                Learn More
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
