import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-[-1] pointer-events-none">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full border border-amber-500/30 bg-black/60 backdrop-blur-xl p-8 rounded-2xl text-center shadow-[0_0_30px_rgba(251,191,36,0.15)]"
      >
        <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/50 relative">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-amber-500/50 animate-ping" />
        </div>

        <h1 className="text-2xl font-bold text-amber-400 uppercase tracking-widest mb-4">
          Payment Under Review
        </h1>

        <p className="text-muted-foreground font-mono text-sm mb-6 leading-relaxed">
          Your M-Pesa payment proof has been received. An admin will verify and
          approve your registration shortly.
        </p>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6 text-left space-y-1">
          <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">Need help?</p>
          <p className="text-xs font-mono text-amber-300">
            WhatsApp: <span className="font-bold">+254758891491</span>
          </p>
        </div>

        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
            RETURN TO TERMINAL
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
