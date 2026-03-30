import { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitRegistration } from "@workspace/api-client-react";
import type { RegistrationInputRegistrationType, RegistrationResponse, ApiError } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playSuccessSound } from "@/lib/utils";
import { Loader2, ChevronRight, CheckCircle2, ShieldAlert, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MPESA_NUMBER = "0758891491";

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
      className="ml-2 p-1 rounded text-primary/70 hover:text-primary hover:bg-primary/10 transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

async function submitPaymentProof(data: { name: string; phone: string; mpesaMessage: string }) {
  const res = await fetch("/api/payment-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Failed to submit payment");
  }
}

const variants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.18 } },
};

type Step = 1 | 2 | 3 | 4;

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "NAME" },
    { n: 2, label: "PHONE" },
    { n: 3, label: "PAYMENT" },
    { n: 4, label: "CONFIRM" },
  ];
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              step > s.n
                ? "bg-primary border-primary text-black"
                : step === s.n
                  ? "border-primary text-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                  : "border-border/40 text-muted-foreground"
            }`}>
              {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[9px] font-mono font-bold tracking-widest ${step >= s.n ? "text-primary" : "text-muted-foreground/50"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-1 mb-4 transition-all ${step > s.n ? "bg-primary/60" : "bg-border/30"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)] p-4 space-y-4">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 text-primary">
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      {children}
    </label>
  );
}

function NeonInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className="font-mono h-11 text-white placeholder:text-white/30 bg-black/40 border-2 border-primary/40 focus:border-primary focus:shadow-[0_0_12px_hsl(var(--primary)/0.4)] focus:outline-none transition-all"
    />
  );
}

export function StandardWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [mpesaMsg, setMpesaMsg] = useState("");
  const [error, setError] = useState("");

  const submitReg = useSubmitRegistration({
    mutation: {
      onError: (err: ApiError) => setError(err.message || "Registration failed."),
    }
  });

  const paymentMutation = useMutation({ mutationFn: submitPaymentProof });

  const clearError = () => setError("");

  const goStep1to2 = () => {
    clearError();
    if (!name.trim() || name.trim().length < 2) { setError("Enter a valid name (min 2 chars)."); return; }
    if (name.trim() !== confirmName.trim()) { setError("Names do not match. Please confirm your name exactly."); return; }
    setStep(2);
  };

  const goStep2to3 = () => {
    clearError();
    if (!phone) { setError("Please enter your phone number."); return; }
    const parsed = parsePhoneNumber(phone);
    if (!parsed || !parsed.isValid()) { setError("Invalid phone number format."); return; }
    if (!confirmPhone) { setError("Please confirm your phone number."); return; }
    const parsedConfirm = parsePhoneNumber(confirmPhone);
    if (!parsedConfirm || parsed.number !== parsedConfirm.number) { setError("Phone numbers do not match."); return; }
    setStep(3);
  };

  const goStep3to4 = () => {
    clearError();
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    clearError();
    if (!mpesaMsg.trim() || mpesaMsg.trim().length < 10) {
      setError("Please paste your full M-Pesa confirmation message.");
      return;
    }
    const parsed = parsePhoneNumber(phone)!;
    const payload = {
      name: name.trim(),
      phone: parsed.number.toString(),
      countryCode: `+${parsed.countryCallingCode}`,
      registrationType: "standard" as RegistrationInputRegistrationType,
      alsoRegisterStandard: false,
    };
    submitReg.mutate(
      { data: payload },
      {
        onSuccess: async (data: RegistrationResponse) => {
          const p = parsePhoneNumber(phone)!;
          await paymentMutation.mutateAsync({
            name: name.trim(),
            phone: p.number.toString(),
            mpesaMessage: mpesaMsg.trim(),
          }).catch(() => {});
          playSuccessSound();
          localStorage.setItem("vcf_claim_standard", data.claimToken);
          localStorage.setItem("vcf_pending_type", "standard");
          setLocation("/pending");
        },
      }
    );
  };

  const isPending = submitReg.isPending || paymentMutation.isPending;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative neon-border bg-black/60">
        <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
          <ShieldAlert className="w-20 h-20 text-primary" />
        </div>
        <CardHeader>
          <CardTitle className="text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
            Standard Registration
          </CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Join the global VCF network. Complete all steps to submit your registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StepIndicator step={step} />
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <FieldBox>
                  <div>
                    <Label>Full Name</Label>
                    <NeonInput
                      placeholder="e.g. Neo Anderson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>Confirm Name</Label>
                    <NeonInput
                      placeholder="Re-type your name exactly"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </div>
                </FieldBox>
                {error && <ErrorBox>{error}</ErrorBox>}
                <Button className="w-full h-12 text-base" onClick={goStep1to2}>
                  NEXT <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <FieldBox>
                  <div>
                    <Label>Phone Number</Label>
                    <div className="rounded-md border-2 overflow-hidden border-primary/40 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-all">
                      <PhoneInput international defaultCountry="KE" value={phone} onChange={(v) => setPhone(v || "")} />
                    </div>
                  </div>
                  <div>
                    <Label>Confirm Phone Number</Label>
                    <div className="rounded-md border-2 overflow-hidden border-primary/40 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-all">
                      <PhoneInput international defaultCountry="KE" value={confirmPhone} onChange={(v) => setConfirmPhone(v || "")} />
                    </div>
                  </div>
                </FieldBox>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(1); }}>BACK</Button>
                  <Button className="flex-[2] h-12 text-base" onClick={goStep2to3}>
                    NEXT <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/8 p-5 flex flex-col items-center gap-3 shadow-[0_0_20px_rgba(251,191,36,0.12)]">
                  <p className="text-xs font-bold font-mono uppercase tracking-widest text-amber-400 text-center">
                    Send <span className="text-amber-300 text-sm">Ksh. 10</span> via M-Pesa to:
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-3xl font-black font-mono text-amber-300 tracking-widest drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                      {MPESA_NUMBER}
                    </span>
                    <CopyBtn text={MPESA_NUMBER} />
                  </div>
                  <p className="text-[10px] font-mono text-amber-400/70 text-center">
                    After sending, click Next and paste the M-Pesa confirmation SMS you received.
                  </p>
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(2); }}>BACK</Button>
                  <Button className="flex-[2] h-12 text-base" onClick={goStep3to4}>
                    I HAVE PAID — NEXT <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <div className="rounded-xl border-2 border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)] p-4 space-y-3">
                  <Label>M-Pesa Confirmation Message</Label>
                  <textarea
                    placeholder={"Paste the full SMS you received from M-Pesa...\n\nExample:\nXFXFXFXFXF Confirmed. Ksh10.00 sent to NUTTERX ADMIN 0758891491 on 30/3/26 at 8:00 AM."}
                    value={mpesaMsg}
                    onChange={(e) => setMpesaMsg(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border-2 border-primary/40 focus:border-primary bg-black/40 px-3 py-2 text-sm font-mono text-white placeholder:text-white/25 resize-none focus:outline-none focus:shadow-[0_0_10px_hsl(var(--primary)/0.3)] transition-all"
                    disabled={isPending}
                  />
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Your message is reviewed by admin to verify your payment.
                  </p>
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(3); }} disabled={isPending}>BACK</Button>
                  <Button className="flex-[2] h-12 text-base" onClick={handleFinalSubmit} disabled={isPending}>
                    {isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> SUBMITTING...</>
                      : "SUBMIT FOR REVIEW"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-sm font-mono rounded-md">
      {">"} ERR: {children}
    </div>
  );
}
