import { Navigation } from "@/components/navigation";
import { CreatePasteForm } from "@/components/create-paste-form";
import { Shield, FileText, Lock, Clock, Eye } from "lucide-react";

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Paste</h1>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Share text and code securely with built-in encryption, malware detection, and access logging. 
              Your content is automatically scanned for security threats.
            </p>
          </div>
        </div>
      </div>

      {/* Security Features Banner */}
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-blue-700">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Malware Detection</span>
            </div>
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>AES-256 Encryption</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Auto-Expiry</span>
            </div>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Access Logging</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      <div className="py-8">
        <CreatePasteForm />
      </div>
    </div>
  );
}