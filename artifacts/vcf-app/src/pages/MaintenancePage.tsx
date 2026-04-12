import { Wrench, Clock, AlertTriangle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MaintenanceStatus {
  enabled: boolean;
  title: string;
  reasons: string[];
  eta: string;
}

export default function MaintenancePage({ status }: { status: MaintenanceStatus }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-background">
      {/* Animated background grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md space-y-6"
      >
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-primary/50 bg-primary/5 flex items-center justify-center shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
              <Wrench className="w-9 h-9 text-primary" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-black" />
            </motion.div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary/60">System Status</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono uppercase tracking-widest text-white leading-tight">
            {status.title}
          </h1>
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            The Nutterx VCF Verification System is temporarily unavailable. We'll be back shortly.
          </p>
        </div>

        {/* Reasons */}
        {status.reasons.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">What's happening</span>
            </div>
            <ul className="space-y-2">
              {status.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs font-mono text-muted-foreground leading-relaxed">
                  <span className="mt-1 w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ETA */}
        {status.eta && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">Estimated Back</p>
              <p className="text-sm font-bold font-mono text-amber-300">{status.eta}</p>
            </div>
          </div>
        )}

        {/* Support */}
        <div className="rounded-xl border border-border/40 bg-muted/5 px-4 py-4 space-y-3">
          <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest text-center">
            Need urgent help?
          </p>
          <a
            href="https://wa.me/254758891491"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button className="w-full h-11 bg-green-700 hover:bg-green-600 text-white font-bold font-mono">
              <MessageCircle className="w-4 h-4 mr-2" />
              WHATSAPP: +254758891491
            </Button>
          </a>
        </div>

        {/* Branding */}
        <p className="text-center text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          NUTTERX VCF VERIFICATION SYSTEM
        </p>
      </motion.div>
    </div>
  );
}
