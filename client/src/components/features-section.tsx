import { ShieldCheck, Lock, Clock, Eye, UserX, Flame } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Malware Detection",
    description: "Automatic scanning for malicious content and sensitive data patterns before sharing.",
    color: "text-primary-500 bg-primary-50",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES encryption with password protection ensures only intended recipients can access your data.",
    color: "text-green-500 bg-green-50",
  },
  {
    icon: Clock,
    title: "Auto Expiry",
    description: "Set automatic expiration times or one-time view limits for maximum privacy.",
    color: "text-amber-500 bg-amber-50",
  },
  {
    icon: Eye,
    title: "Access Monitoring",
    description: "Detailed logs of who accessed your pastes, when, and from where.",
    color: "text-blue-500 bg-blue-50",
  },
  {
    icon: UserX,
    title: "Anonymous Sharing",
    description: "Create pastes without an account for maximum anonymity when needed.",
    color: "text-purple-500 bg-purple-50",
  },
  {
    icon: Flame,
    title: "Self-Destruct",
    description: "Automatically delete pastes after first view for ultra-sensitive content.",
    color: "text-red-500 bg-red-50",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Built for Security & Privacy</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Advanced security features to protect your sensitive data and code snippets
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
