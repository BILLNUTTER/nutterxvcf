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
import { friendlyError } from "@/lib/friendly-error";
import { Loader2, ChevronRight, CheckCircle2, ShieldAlert, Smartphone, RefreshCw, Search, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const variants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.18 } },
};

type Step = 1 | 2 | 3;
type PayStep = "idle" | "initiating" | "waiting" | "verifying" | "success" | "failed" | "manual_done";

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
    <div className="p-3 border border-destructive/60 bg-destructive/10 text-destructive text-sm rounded-md leading-relaxed">
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 border border-amber-500/40 bg-amber-500/8 text-amber-300 text-xs font-mono rounded-md leading-relaxed">
      {children}
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
  if (!res.ok) throw new Error(json.message ?? "Failed to initiate payment. Please try again.");
  return { reference: json.reference! };
}

async function pollPaylorStatus(reference: string): Promise<{ status: string; mpesaReceipt?: string; failureReason?: string }> {
  const res = await fetch(`/api/paylor/status/${encodeURIComponent(reference)}`);
  if (!res.ok) throw new Error("Could not check payment status.");
  return res.json() as Promise<{ status: string; mpesaReceipt?: string; failureReason?: string }>;
}

async function verifyPayment(reference: string): Promise<{ status: string; message: string }> {
  const res = await fetch("/api/paylor/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  const json = await res.json() as { status?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? "Could not verify payment. Please try again.");
  return { status: json.status ?? "pending", message: json.message ?? "" };
}

async function checkPhoneAvailability(phone: string): Promise<{ status: "available" | "already_registered" | "suspended" }> {
  const res = await fetch(`/api/check-phone?phone=${encodeURIComponent(phone)}&type=standard`);
  if (!res.ok) return { status: "available" }; // fail open — server will catch at registration
  return res.json() as Promise<{ status: "available" | "already_registered" | "suspended" }>;
}

async function submitRegistrationDirect(name: string, phone: string, countryCode: string): Promise<{ id: number }> {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, countryCode, registrationType: "standard" }),
  });
  const json = await res.json() as { id?: number; error?: string; message?: string };
  if (!res.ok) throw Object.assign(new Error(json.message ?? "Registration failed"), { status: res.status, data: json });
  return { id: json.id! };
}

async function submitManualPayment(name: string, phone: string, mpesaMessage: string): Promise<void> {
  const res = await fetch("/api/payment-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, mpesaMessage }),
  });
  if (!res.ok) {
    const json = await res.json() as { error?: string; message?: string };
    throw Object.assign(new Error(json.message ?? "Submission failed"), { status: res.status, data: json });
  }
}

export function StandardWizard({ registrationFee = 10 }: { registrationFee?: number }) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payPhone, setPayPhone] = useState(""); // M-Pesa payment phone (may differ from registration phone)
  const [error, setError] = useState("");

  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [reference, setReference] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [paylorEnabled, setPaylorEnabled] = useState<boolean | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [mpesaMsg, setMpesaMsg] = useState("");
  const [copied, setCopied] = useState(false);
  // Keep the registrationId across retries so we don't re-create the row and
  // hit the unique (phone, type) constraint when the user clicks "TRY AGAIN".
  const [registrationId, setRegistrationId] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    fetchPaylorConfig()
      .then((c) => setPaylorEnabled(c.enabled))
      .catch(() => setPaylorEnabled(false));
  }, []);

  const submitReg = useSubmitRegistration({
    mutation: {
      onError: (err: ApiError) => {
        setError(friendlyError(err, "Registration failed. Please try again."));
        setPayStep("idle");
      },
    },
  });

  const clearError = () => setError("");

  const goToPhone = () => {
    clearError();
    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    setStep(2);
  };

  const goToPayment = async () => {
    clearError();
    if (!phone) { setError("Please enter your phone number."); return; }
    const parsed = parsePhoneNumber(phone);
    if (!parsed || !parsed.isValid()) { setError("That phone number doesn't look right. Please check and try again."); return; }

    setCheckingPhone(true);
    try {
      const check = await checkPhoneAvailability(parsed.number.toString());
      if (check.status === "already_registered") {
        setError("This number is already registered. Please use a different phone number.");
        return;
      }
      if (check.status === "suspended") {
        setError("This number has been suspended. Contact support on +254758891491.");
        return;
      }
    } catch { /* fail open — server will re-check on registration */ } finally {
      setCheckingPhone(false);
    }

    if (!payPhone) setPayPhone(phone);
    setStep(3);
  };

  const handleManualSubmit = async () => {
    clearError();
    if (!mpesaMsg.trim()) { setError("Please paste your M-Pesa confirmation SMS."); return; }
    setPayStep("initiating");
    const parsed = parsePhoneNumber(phone);
    const e164 = parsed?.number.toString() ?? phone;
    const cc = `+${parsed?.countryCallingCode ?? "254"}`;

    try {
      let regId = registrationId;
      if (regId === null) {
        const reg = await submitRegistrationDirect(name.trim(), e164, cc);
        regId = reg.id;
        setRegistrationId(regId);
      }
      await submitManualPayment(name.trim(), e164, mpesaMsg.trim());
      playSuccessSound();
      setPayStep("manual_done");
    } catch (err) {
      setError(friendlyError(err, "Could not submit payment proof. Please try again."));
      setPayStep("idle");
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText("0758891491").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handlePaymentConfirmed = () => {
    stopPolling();
    localStorage.setItem("vcf_pending_type", "standard");
    setPayStep("success");
    playSuccessSound();
    setTimeout(() => setLocation("/pending"), 1400);
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
        setError("The M-Pesa prompt was not completed in time. Please press \"Try Again\" to restart, or use the \"Verify Payment\" button if you already paid.");
        return;
      }

      try {
        const result = await pollPaylorStatus(ref);
        if (result.status === "completed") {
          handlePaymentConfirmed();
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

  const sendStkPush = async (regId: number, parsedPay: ReturnType<typeof parsePhoneNumber>) => {
    try {
      const { reference: ref } = await initiatePaylorPush({
        registrationId: regId,
        phone: parsedPay!.number.toString(),
        name: name.trim(),
      });
      setReference(ref);
      setPayStep("waiting");
      startPolling(ref);
    } catch (err: unknown) {
      setError(friendlyError(err, "Failed to send payment prompt. Please try again."));
      setPayStep("failed");
    }
  };

  const handlePayNow = async () => {
    clearError();

    const effectivePayPhone = payPhone || phone;
    const parsedPay = parsePhoneNumber(effectivePayPhone);
    if (!parsedPay || !parsedPay.isValid()) {
      setError("The M-Pesa phone number doesn't look right. Please check it and try again.");
      return;
    }

    setPayStep("initiating");

    // If we already have a registration from a previous attempt, reuse it —
    // this prevents hitting the unique (phone, type) constraint on retry.
    if (registrationId !== null) {
      await sendStkPush(registrationId, parsedPay);
      return;
    }

    const parsedReg = parsePhoneNumber(phone)!;
    const payload = {
      name: name.trim(),
      phone: parsedReg.number.toString(),
      countryCode: `+${parsedReg.countryCallingCode}`,
      registrationType: "standard" as RegistrationInputRegistrationType,
      alsoRegisterStandard: false,
    };

    submitReg.mutate(
      { data: payload },
      {
        onSuccess: async (data: RegistrationResponse) => {
          setRegistrationId(data.id);
          await sendStkPush(data.id, parsedPay);
        },
      },
    );
  };

  const handleVerifyPayment = async () => {
    if (!reference) return;
    clearError();
    setPayStep("verifying");
    try {
      const result = await verifyPayment(reference);
      if (result.status === "completed") {
        handlePaymentConfirmed();
      } else if (result.status === "failed") {
        setPayStep("failed");
        setError(result.message || "Payment was not completed. Please try again.");
      } else {
        // Still pending
        setPayStep("waiting");
        setError(result.message || "Payment not confirmed yet. Please enter your M-Pesa PIN if prompted.");
        startPolling(reference);
      }
    } catch (err: unknown) {
      setPayStep("waiting");
      setError(friendlyError(err, "Could not verify payment right now. Please wait and try again."));
      startPolling(reference);
    }
  };

  const handleRetry = () => {
    stopPolling();
    setPayStep("idle");
    setReference("");
    setElapsed(0);
    clearError();
    // Do NOT clear registrationId here — reusing it avoids the "already
    // registered" error when the user retries with the same phone number.
    submitReg.reset();
  };

  const handleChangePhone = () => {
    handleRetry();
    setRegistrationId(null); // New phone = new registration row is allowed
    setStep(2);
  };

  useEffect(() => () => stopPolling(), []);

  const secondsLeft = Math.max(0, Math.round((POLL_TIMEOUT_MS - elapsed) / 1000));
  const effectivePayPhone = payPhone || phone;
  const parsedPayPhone = effectivePayPhone ? parsePhoneNumber(effectivePayPhone) : null;

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

            {/* ── Step 2: Registration Phone ── */}
            {step === 2 && (
              <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-5">
                <FieldBox>
                  <Label>Your Phone Number (for VCF contact)</Label>
                  <div className="rounded-md border-2 overflow-hidden border-primary/40 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.4)] transition-all">
                    <PhoneInput international defaultCountry="KE" value={phone} onChange={(v) => setPhone(v || "")} />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
                    This number will appear in the VCF contact card shared in the group.
                  </p>
                </FieldBox>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(1); }}>BACK</Button>
                  <Button className="flex-[2] h-12 text-base" onClick={goToPayment} disabled={checkingPhone}>
                    {checkingPhone ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />CHECKING...</> : <>NEXT <ChevronRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Payment ── */}
            {step === 3 && (
              <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" className="space-y-4">

                {/* Idle / ready to pay */}
                {payStep === "idle" && (
                  <>
                    {/* ── PAYLOR ENABLED: STK Push ── */}
                    {paylorEnabled !== false && (
                      <>
                        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/8 px-4 py-4 flex flex-col gap-3 shadow-[0_0_16px_rgba(251,191,36,0.1)]">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
                            <p className="text-sm font-bold font-mono uppercase tracking-widest text-amber-300">
                              M-Pesa Payment — Ksh. {registrationFee}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-mono text-amber-400/80 uppercase tracking-wider">
                              M-Pesa number to receive the PIN prompt:
                            </p>
                            <div className="rounded-md border-2 overflow-hidden border-amber-500/40 focus-within:border-amber-400 focus-within:shadow-[0_0_10px_rgba(251,191,36,0.25)] transition-all bg-black/40">
                              <PhoneInput
                                international
                                defaultCountry="KE"
                                value={effectivePayPhone}
                                onChange={(v) => setPayPhone(v || "")}
                              />
                            </div>
                            <p className="text-[10px] font-mono text-amber-400/60 leading-relaxed">
                              Change this if you want to pay from a different number than your registered one.
                            </p>
                          </div>
                        </div>
                        {error && <ErrorBox>{error}</ErrorBox>}
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(2); }}>BACK</Button>
                          <Button
                            className="flex-[2] h-12 text-base bg-amber-600 hover:bg-amber-500 text-black font-bold shadow-[0_0_16px_rgba(251,191,36,0.3)]"
                            onClick={handlePayNow}
                          >
                            PAY KSH {registrationFee} VIA M-PESA
                          </Button>
                        </div>
                      </>
                    )}

                    {/* ── PAYLOR DISABLED: Manual payment form ── */}
                    {paylorEnabled === false && (
                      <>
                        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/8 px-4 py-4 flex flex-col gap-3 shadow-[0_0_16px_rgba(251,191,36,0.1)]">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
                            <p className="text-sm font-bold font-mono uppercase tracking-widest text-amber-300">
                              Manual M-Pesa Payment — Ksh. {registrationFee}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-mono text-amber-300/80 leading-relaxed">
                              Send <span className="font-bold text-amber-300">Ksh {registrationFee}</span> via M-Pesa to this number:
                            </p>
                            <button
                              onClick={copyNumber}
                              className="w-full flex items-center justify-between rounded-lg border border-amber-500/50 bg-black/40 px-4 py-3 hover:bg-amber-500/10 transition-colors group"
                            >
                              <span className="text-xl font-bold font-mono text-white tracking-widest">0758891491</span>
                              <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70 group-hover:text-amber-400 transition-colors">
                                {copied ? <><Check className="w-3 h-3" />COPIED</> : <><Copy className="w-3 h-3" />TAP TO COPY</>}
                              </span>
                            </button>
                            <p className="text-[10px] font-mono text-amber-400/60 leading-relaxed">
                              Paybill/Send Money. After sending, paste the M-Pesa SMS confirmation below.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-mono text-amber-400/80 uppercase tracking-wider">
                              Paste your M-Pesa confirmation SMS:
                            </p>
                            <textarea
                              value={mpesaMsg}
                              onChange={(e) => setMpesaMsg(e.target.value)}
                              rows={4}
                              placeholder={"e.g. TXN123ABC confirmed. Ksh10.00 sent to 0758891491..."}
                              className="w-full rounded-md border-2 border-amber-500/40 bg-black/40 px-3 py-2.5 text-xs font-mono text-white placeholder:text-muted-foreground/40 focus:border-amber-400 focus:outline-none focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] transition-all resize-none"
                            />
                          </div>
                        </div>
                        {error && <ErrorBox>{error}</ErrorBox>}
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 h-12" onClick={() => { clearError(); setStep(2); }}>BACK</Button>
                          <Button
                            className="flex-[2] h-12 text-base bg-amber-600 hover:bg-amber-500 text-black font-bold shadow-[0_0_16px_rgba(251,191,36,0.3)]"
                            onClick={handleManualSubmit}
                          >
                            SUBMIT PAYMENT PROOF
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Initiating: creating registration */}
                {payStep === "initiating" && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-mono text-primary text-center">Sending M-Pesa prompt...</p>
                  </div>
                )}

                {/* Waiting: STK push sent, polling */}
                {payStep === "waiting" && (
                  <div className="flex flex-col items-center gap-4 py-4">
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
                        <span className="text-white font-bold">{parsedPayPhone?.formatInternational() ?? effectivePayPhone}</span>
                        <br />Enter your PIN to complete the Ksh {registrationFee} payment.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking automatically... {secondsLeft}s
                    </div>

                    {error && <ErrorBox>{error}</ErrorBox>}

                    {/* Verify Payment — manual live check */}
                    <Button
                      className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-black font-bold"
                      onClick={handleVerifyPayment}
                    >
                      <Search className="w-4 h-4 mr-2" /> VERIFY PAYMENT
                    </Button>

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

                {/* Verifying: manual live check in progress */}
                {payStep === "verifying" && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                    <p className="text-sm font-bold font-mono text-amber-300 uppercase tracking-widest text-center">
                      Checking Payment Status...
                    </p>
                    <p className="text-xs font-mono text-muted-foreground text-center">
                      Querying payment gateway directly. Please wait.
                    </p>
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
                      Taking you to the WhatsApp group...
                    </p>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Failed */}
                {payStep === "failed" && (
                  <div className="flex flex-col gap-4">
                    {error && <ErrorBox>{error}</ErrorBox>}
                    {reference && (
                      <Button
                        className="w-full h-12 bg-amber-600 hover:bg-amber-500 text-black font-bold"
                        onClick={handleVerifyPayment}
                      >
                        <Search className="w-4 h-4 mr-2" /> VERIFY PAYMENT
                      </Button>
                    )}
                    <Button
                      className="w-full h-12"
                      onClick={handleRetry}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> TRY AGAIN
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-10"
                      onClick={handleChangePhone}
                    >
                      CHANGE PHONE NUMBER
                    </Button>
                  </div>
                )}

                {/* Manual payment submitted — pending admin review */}
                {payStep === "manual_done" && (
                  <div className="flex flex-col items-center gap-5 py-6">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-500/50 bg-amber-500/10 flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.2)]">
                      <CheckCircle2 className="w-9 h-9 text-amber-400" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-bold font-mono text-amber-300 uppercase tracking-widest">
                        Payment Proof Received!
                      </p>
                      <p className="text-xs font-mono text-muted-foreground leading-relaxed max-w-xs">
                        Your payment proof has been submitted for review. An admin will verify and approve your registration shortly.
                      </p>
                    </div>
                    <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center space-y-1">
                      <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">Need help?</p>
                      <p className="text-xs font-mono text-amber-300">WhatsApp: <span className="font-bold">+254758891491</span></p>
                    </div>
                    <a
                      href="https://chat.whatsapp.com/BYzNlaEiCS9LPblEXIYJnA?mode=gi_t"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-bold shadow-[0_0_16px_rgba(74,222,128,0.2)]">
                        JOIN WHATSAPP GROUP WHILE WAITING
                      </Button>
                    </a>
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
