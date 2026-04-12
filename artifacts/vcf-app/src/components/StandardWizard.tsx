import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useSubmitRegistration } from "@workspace/api-client-react";
import type { RegistrationInputRegistrationType, RegistrationResponse, ApiError } from "@workspace/api-client-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playSuccessSound } from "@/lib/utils";
import { Loader2, ChevronRight, CheckCircle2, ShieldAlert, Smartphone, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const variants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.18 } },
};

type Step = 1 | 2 | 3;
type PayStep = "idle" | "initiating" | "waiting" | "success" | "failed";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "NAME" },
    { n: 2, label: "PHONE" },
    { n: 3, label: "PAYMENT" },
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
    <div className="rounded-xl border-2 border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)] p-4 space-y-3">
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

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-sm font-mono rounded-md">
      {">"} ERR: {children}
    </div>
  );
}

async function fetchPaylorConfig(): Promise<{ enabled: boolean }> {
  const res = await fetch("/api/paylor/config");
  if (!res.ok) return { enabled: false };
  return res.json() as Promise<{ enabled: boolean }>;
}

async function initiatePaylorPush(data: { registrationId: number; phone: string; name: string }): Promise<{ reference: string }> {
  const res = await fetch("/api/paylor/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { reference?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? "Failed to initiate payment");
  return { reference: json.reference! };
}

async function pollPaylorStatus(reference: string): Promise<{ status: string; mpesaReceipt?: string; failureReason?: string }> {
  const res = await fetch(`/api/paylor/status/${encodeURIComponent(reference)}`);
  if (!res.ok) throw new Error("Status check failed");
  return res.json() as Promise<{ status: string; mpesaReceipt?: string; failureReason?: string }>;
}

export function StandardWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [reference, setReference] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [paylorEnabled, setPaylorEnabled] = useState<boolean | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  // Check if Paylor is configured on mount
  useEffect(() => {
    fetchPaylorConfig()
      .then((c) => setPaylorEnabled(c.enabled))
      .catch(() => setPaylorEnabled(false));
  }, []);

  const submitReg = useSubmitRegistration({
    mutation: {
      onError: (err: ApiError) => {
        setError(err.message || "Registration failed.");
        setPayStep("idle");
      },
    },
  });

  const clearError = () => setError("");

  const goToPhone = () => {
    clearError();
    if (!name.trim() || name.trim().length < 2) {
      setError("Enter your full name (min 2 characters).");
      return;
    }
    setStep(2);
  };

  const goToPayment = () => {
    clearError();
    if (!phone) { setError("Please enter your phone number."); return; }
    const parsed = parsePhoneNumber(phone);
    if (!parsed || !parsed.isValid()) { setError("Invalid phone number format."); return; }
    setStep(3);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (ref: string) => {
    elapsedRef.current = 0;
    setElapsed(0);
    stopPolling();

    pollRef.current = setInterval(async () => {
      elapsedRef.current += POLL_INTERVAL_MS;
      setElapsed(elapsedRef.current);

      if (elapsedRef.current >= POLL_TIMEOUT_MS) {
        stopPolling();
        setPayStep("failed");
        setError("Payment timed out. The M-Pesa prompt was not responded to in time. Please try again.");
        return;
      }

      try {
        const result = await pollPaylorStatus(ref);
        if (result.status === "completed") {
          stopPolling();
          setPayStep("success");
          playSuccessSound();
          setTimeout(() => setLocation("/pending"), 1200);
        } else if (result.status === "failed" || result.status === "cancelled") {
          stopPolling();
          setPayStep("failed");
          setError(result.failureReason ?? "Payment was not completed. Please try again.");
        }
      } catch {
        // ignore transient poll errors
      }
    }, POLL_INTERVAL_MS);
  };

  const handlePayNow = async () => {
    clearError();
    setPayStep("initiating");

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
          localStorage.setItem("vcf_claim_standard", data.claimToken);
          localStorage.setItem("vcf_pending_type", "standard");

          try {
            const { reference: ref } = await initiatePaylorPush({
              registrationId: data.id,
              phone: parsed.number.toString(),
              name: name.trim(),
            });
            setReference(ref);
            setPayStep("waiting");
            startPolling(ref);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send payment prompt.";
            setError(msg);
            setPayStep("failed");
          }
        },
      },
    );
  };

  const handleRetry = () => {
    stopPolling();
    setPayStep("idle");
    setReference("");
    setElapsed(0);
    clearError();
    // Reset registration so they re-submit on next attempt
    submitReg.reset();
  };

  useEffect(() => () => stopPolling(), []);

  const secondsLeft = Math.max(0, Math.round((POLL_TIMEOUT_MS - elapsed) / 1000));

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

            {/* ── Step 1: Name ── */}
            {step === 1 && (
              <motion.div key="s1" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <FieldBox>
                  <Label>Full Name</Label>
                  <Input
                    placeholder="e.g. Calvin Osoro"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && goToPhone()}
                    className="font-mono h-11 text-white placeholder:text-white/30 bg-black/40 border-2 border-primary/40 focus:border-primary focus:shadow-[0_0_12px_hsl(var(--primary)/0.4)] focus:outline-none transition-all"
                    autoFocus
                  />
                </FieldBox>
                {error && <ErrorBox>{error}</ErrorBox>}
                <Button className="w-full h-12 text-base" onClick={goToPhone}>
                  NEXT <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Phone ── */}
            {step === 2 && (
              <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <FieldBox>
                  <Label>Phone Number</Label>
                  <div className="rounded-md border-2 overflow-hidden border-primary/40 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-all">
                    <PhoneInput international defaultCountry="KE" value={phone} onChange={(v) => setPhone(v || "")} />
                  </div>
                </FieldBox>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(1); }}>BACK</Button>
                  <Button className="flex-[2] h-12 text-base" onClick={goToPayment}>
                    NEXT <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Paylor STK Push ── */}
            {step === 3 && (
              <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">

                {/* Idle / ready to pay */}
                {payStep === "idle" && (
                  <>
                    <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/8 px-4 py-4 flex flex-col items-center gap-2 shadow-[0_0_16px_rgba(251,191,36,0.1)]">
                      <Smartphone className="w-8 h-8 text-amber-400" />
                      <p className="text-sm font-bold font-mono uppercase tracking-widest text-amber-300 text-center">
                        M-Pesa Payment
                      </p>
                      <p className="text-xs text-amber-400/80 font-mono text-center leading-relaxed">
                        Click <span className="text-amber-300 font-bold">PAY KSH 10</span> and you will receive an M-Pesa PIN prompt on your phone{" "}
                        <span className="text-amber-300 font-bold">{parsePhoneNumber(phone)?.formatInternational()}</span>.
                        Enter your PIN to complete payment.
                      </p>
                      <div className="mt-1 px-3 py-1.5 rounded-full border border-amber-500/40 bg-black/40">
                        <span className="text-2xl font-black font-mono text-amber-300 tracking-widest drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                          Ksh. 10
                        </span>
                      </div>
                    </div>

                    {paylorEnabled === false && (
                      <div className="p-3 border border-amber-600/50 bg-amber-600/10 text-amber-400 text-xs font-mono rounded-md">
                        ⚠ Automated payments not yet configured. Contact admin at 0758891491.
                      </div>
                    )}

                    {error && <ErrorBox>{error}</ErrorBox>}

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(2); }}>
                        BACK
                      </Button>
                      <Button
                        className="flex-[2] h-12 text-base bg-amber-600 hover:bg-amber-500 text-black font-bold shadow-[0_0_16px_rgba(251,191,36,0.3)]"
                        onClick={handlePayNow}
                        disabled={paylorEnabled === false}
                      >
                        PAY KSH 10 VIA M-PESA
                      </Button>
                    </div>
                  </>
                )}

                {/* Initiating: creating registration */}
                {payStep === "initiating" && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-mono text-primary text-center">Creating your registration...</p>
                  </div>
                )}

                {/* Waiting: STK push sent, polling */}
                {payStep === "waiting" && (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
                        <Smartphone className="w-8 h-8 text-amber-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-bold font-mono text-amber-300 uppercase tracking-widest">
                        Check Your Phone!
                      </p>
                      <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                        An M-Pesa PIN prompt has been sent to<br />
                        <span className="text-white font-bold">{parsePhoneNumber(phone)?.formatInternational()}</span>
                        <br />Enter your PIN to complete the Ksh 10 payment.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Waiting for confirmation... {secondsLeft}s
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={handleRetry}
                    >
                      Cancel &amp; Try Again
                    </Button>
                  </div>
                )}

                {/* Success */}
                {payStep === "success" && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <CheckCircle2 className="w-14 h-14 text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]" />
                    <p className="text-sm font-bold font-mono text-green-400 uppercase tracking-widest text-center">
                      Payment Confirmed!
                    </p>
                    <p className="text-xs font-mono text-muted-foreground text-center">
                      Redirecting to your registration status...
                    </p>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Failed */}
                {payStep === "failed" && (
                  <div className="flex flex-col gap-4">
                    {error && <ErrorBox>{error}</ErrorBox>}
                    <Button
                      className="w-full h-12"
                      onClick={handleRetry}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> TRY AGAIN
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-10"
                      onClick={() => { handleRetry(); setStep(2); }}
                    >
                      CHANGE PHONE NUMBER
                    </Button>
                  </div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
