import { useEffect } from "react";
import { Link } from "wouter";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const STANDARD_GROUP_LINK = "https://chat.whatsapp.com/BYzNlaEiCS9LPblEXIYJnA?mode=gi_t";

export default function PendingPage() {
  useEffect(() => {
    const pendingType = localStorage.getItem("vcf_pending_type");
    if (pendingType === "standard") {
      window.location.href = STANDARD_GROUP_LINK;
    }
  }, []);

  const pendingType = typeof window !== "undefined" ? localStorage.getItem("vcf_pending_type") : null;
  const isStandard = pendingType === "standard";

  if (isStandard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full border border-green-500/30 bg-black/60 backdrop-blur-xl p-8 rounded-2xl text-center shadow-[0_0_30px_rgba(22,163,74,0.15)]"
        >
          <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/50 relative">
            <ShieldAlert className="w-10 h-10 text-green-500" />
            <div className="absolute inset-0 rounded-full border border-green-500/50 animate-ping" />
          </div>
          <h1 className="text-2xl font-bold text-green-500 uppercase tracking-widest mb-4">
            Redirecting...
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            Taking you to the WhatsApp group...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-[-1] pointer-events-none">
        <div className="absolute inset-0 bg-background"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/10 blur-[100px] rounded-full"></div>
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full border border-yellow-500/30 bg-black/60 backdrop-blur-xl p-8 rounded-2xl text-center shadow-[0_0_30px_rgba(234,179,8,0.15)]"
      >
        <div className="w-20 h-20 mx-auto bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border border-yellow-500/50 relative">
          <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-yellow-500/50 animate-ping"></div>
        </div>

        <h1 className="text-2xl font-bold text-yellow-500 uppercase tracking-widest mb-4">
          Verification Pending
        </h1>

        <p className="text-muted-foreground font-mono text-sm mb-8 leading-relaxed">
          Your data has been transmitted securely. The system administrators are currently reviewing your profile.
          <br /><br />
          Once approved, returning to the main terminal will automatically grant you access to the secure VCF network group.
        </p>

        <Link href="/" className="w-full">
          <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
            RETURN TO TERMINAL
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
