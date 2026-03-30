import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSuccessSound } from "@/lib/utils";

const ADMIN_WHATSAPP = "0713881613";
const ADMIN_WA_LINK = "https://wa.me/254713881613";

type CheckStatus = "idle" | "checking" | "not_verified" | "verified" | "registered";
type FlowStep = "contact" | "check" | "name" | "done";

async function checkBotVerification(phone: string): Promise<{ status: string }> {
  const res = await fetch(`/api/bot-check?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error("Failed to check verification");
  return res.json() as Promise<{ status: string }>;
}

async function completeBotRegistration(phone: string, name: string): Promise<void> {
  const res = await fetch("/api/bot-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, name }),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Registration failed");
  }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-secondary/50 text-secondary hover:bg-secondary/10 transition-all ml-2"
    >
      {copied ? "COPIED!" : "COPY"}
    </button>
  );
}

const variants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.18 } },
};

export function BotFlow() {
  const [flowStep, setFlowStep] = useState<FlowStep>("contact");
  const [phone, setPhone] = useState("");
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const checkMutation = useMutation({
    mutationFn: (ph: string) => checkBotVerification(ph),
    onSuccess: (data) => {
      if (data.status === "verified") {
        setCheckStatus("verified");
        const parsed = parsePhoneNumber(phone);
        setVerifiedPhone(parsed?.number.toString() ?? phone);
        setFlowStep("name");
      } else if (data.status === "registered") {
        setCheckStatus("registered");
      } else {
        setCheckStatus("not_verified");
      }
    },
    onError: () => setCheckStatus("not_verified"),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeBotRegistration(verifiedPhone, name.trim()),
    onSuccess: () => {
      playSuccessSound();
      setFlowStep("done");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCheck = () => {
    setError("");
    if (!phone) { setError("Please enter your phone number."); return; }
    const parsed = parsePhoneNumber(phone);
    if (!parsed || !parsed.isValid()) { setError("Invalid phone number format."); return; }
    setCheckStatus("checking");
    checkMutation.mutate(parsed.number.toString());
  };

  const handleCompleteName = () => {
    setError("");
    if (!name.trim() || name.trim().length < 2) { setError("Enter your full name (min 2 chars)."); return; }
    completeMutation.mutate();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative neon-border-cyan bg-black/60">
        <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
          <Smartphone className="w-20 h-20 text-secondary" />
        </div>
        <CardHeader>
          <CardTitle className="text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.5)]">
            WhatsApp Bot VCF
          </CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Exclusive network for WhatsApp bot operators. Free to join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">

            {flowStep === "contact" && (
              <motion.div key="contact" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="rounded-xl border-2 border-secondary/50 bg-secondary/5 shadow-[0_0_20px_hsl(var(--secondary)/0.1)] p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-secondary shrink-0" />
                    <span className="text-xs font-bold font-mono uppercase tracking-widest text-secondary">
                      Step 1 — Prove You Have a WhatsApp Bot
                    </span>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground leading-relaxed">
                    Send a WhatsApp message to the admin number below to show that you own a WhatsApp bot. Admin will verify your number and add it to the system.
                  </p>
                  <div className="rounded-lg border border-secondary/30 bg-black/40 p-4 flex flex-col items-center gap-2">
                    <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-secondary/70">
                      Admin WhatsApp — Text Here First
                    </p>
                    <div className="flex items-center gap-1">
                      <a
                        href={ADMIN_WA_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="text-2xl font-black font-mono text-secondary tracking-widest drop-shadow-[0_0_10px_hsl(var(--secondary)/0.6)] hover:text-secondary/80 transition-colors"
                      >
                        {ADMIN_WHATSAPP}
                      </a>
                      <CopyBtn text={ADMIN_WHATSAPP} />
                    </div>
                    <a
                      href={ADMIN_WA_LINK}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1.5 text-xs font-mono font-bold text-green-400 border border-green-500/40 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      OPEN WHATSAPP CHAT
                    </a>
                  </div>
                </div>
                <Button
                  className="w-full h-12 text-base border-2 border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20 shadow-[0_0_10px_hsl(var(--secondary)/0.2)]"
                  variant="ghost"
                  onClick={() => setFlowStep("check")}
                >
                  I HAVE MESSAGED ADMIN — CHECK MY STATUS
                </Button>
              </motion.div>
            )}

            {flowStep === "check" && (
              <motion.div key="check" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="rounded-xl border-2 border-secondary/50 bg-secondary/5 shadow-[0_0_20px_hsl(var(--secondary)/0.1)] p-4 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                      Your Phone Number
                    </label>
                    <div className="rounded-md border-2 overflow-hidden border-secondary/40 focus-within:border-secondary focus-within:shadow-[0_0_12px_hsl(var(--secondary)/0.4)] transition-all">
                      <PhoneInput
                        international
                        defaultCountry="KE"
                        value={phone}
                        onChange={(v) => { setPhone(v || ""); setCheckStatus("idle"); }}
                        disabled={checkMutation.isPending}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                      Enter the number you used to WhatsApp the admin.
                    </p>
                  </div>

                  {checkStatus === "not_verified" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        <p className="text-xs font-mono font-bold text-destructive">NOT YET VERIFIED</p>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">
                        Your number has not been verified yet. Please DM the admin on WhatsApp first, then check again after admin confirms you.
                      </p>
                      <a
                        href={ADMIN_WA_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-green-400 border border-green-500/40 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        DM ADMIN ON WHATSAPP
                      </a>
                    </motion.div>
                  )}

                  {checkStatus === "registered" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      <p className="text-xs font-mono text-green-300">
                        This number is already registered in the Bot VCF network!
                      </p>
                    </motion.div>
                  )}
                </div>

                {error && (
                  <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-sm font-mono rounded-md">
                    {">"} ERR: {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 border-secondary/40 text-secondary/70" onClick={() => { setCheckStatus("idle"); setFlowStep("contact"); }}>
                    BACK
                  </Button>
                  <Button
                    className="flex-[2] h-12 text-base border-2 border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20"
                    variant="ghost"
                    onClick={handleCheck}
                    disabled={checkMutation.isPending}
                  >
                    {checkMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> CHECKING...</>
                      : "CHECK VERIFICATION STATUS"}
                  </Button>
                </div>
              </motion.div>
            )}

            {flowStep === "name" && (
              <motion.div key="name" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <p className="text-sm font-mono font-bold text-green-300">
                    Bot verified! Enter your name to complete registration.
                  </p>
                </div>
                <div className="rounded-xl border-2 border-secondary/50 bg-secondary/5 shadow-[0_0_20px_hsl(var(--secondary)/0.1)] p-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                    Your Name (appears in VCF contacts)
                  </label>
                  <Input
                    placeholder="e.g. Neo Anderson"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="font-mono h-11 text-white placeholder:text-white/30 bg-black/40 border-2 border-secondary/40 focus:border-secondary focus:shadow-[0_0_12px_hsl(var(--secondary)/0.4)] focus:outline-none transition-all"
                    disabled={completeMutation.isPending}
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-sm font-mono rounded-md">
                    {">"} ERR: {error}
                  </div>
                )}
                <Button
                  className="w-full h-12 text-base"
                  variant="secondary"
                  onClick={handleCompleteName}
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> REGISTERING...</>
                    : "COMPLETE BOT REGISTRATION"}
                </Button>
              </motion.div>
            )}

            {flowStep === "done" && (
              <motion.div key="done" variants={variants} initial="enter" animate="center" exit="exit" className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.6)]" />
                <div>
                  <p className="font-bold text-green-300 tracking-widest text-lg">REGISTRATION COMPLETE!</p>
                  <p className="text-sm font-mono text-muted-foreground mt-2">
                    Welcome, <span className="text-secondary font-bold">{name}</span>! Your number has been added to the Bot VCF network.
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    Your contact will appear in the VCF directory below.
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
