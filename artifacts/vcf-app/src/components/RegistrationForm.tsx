import { useState } from "react";
import { useLocation } from "wouter";
import { useSubmitRegistration } from "@workspace/api-client-react";
import type { RegistrationInputRegistrationType, RegistrationResponse, ApiError } from "@workspace/api-client-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { playSuccessSound } from "@/lib/utils";
import { Loader2, TerminalSquare, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { CopyableNumber } from "@/components/CopyableNumber";

interface Props {
  type: "standard" | "bot";
  title: string;
  description: string;
  crossRegisterLabel?: string;
  accentColor: "primary" | "secondary";
}

export function RegistrationForm({ type, title, description, crossRegisterLabel, accentColor }: Props) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [alsoRegisterOther, setAlsoRegisterOther] = useState(false);
  const [error, setError] = useState("");

  const submitMutation = useSubmitRegistration({
    mutation: {
      onSuccess: (data: RegistrationResponse) => {
        playSuccessSound();
        localStorage.setItem(`vcf_claim_${type}`, data.claimToken);
        localStorage.setItem("vcf_pending_type", type);
        if (data.crossClaimToken) {
          const otherType = type === "standard" ? "bot" : "standard";
          localStorage.setItem(`vcf_claim_${otherType}`, data.crossClaimToken);
        }
        setLocation("/pending");
      },
      onError: (err: ApiError) => {
        setError(err.message || "Registration failed. Please try again.");
      }
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || name.trim().length < 2) {
      setError("Please enter a valid name.");
      return;
    }

    if (!phone) {
      setError("Please enter a valid phone number.");
      return;
    }

    const parsedPhone = parsePhoneNumber(phone);
    if (!parsedPhone || !parsedPhone.isValid()) {
      setError("Invalid phone number format.");
      return;
    }

    const payload = {
      name: name.trim(),
      phone: parsedPhone.number.toString(),
      countryCode: `+${parsedPhone.countryCallingCode}`,
      registrationType: type as RegistrationInputRegistrationType,
      alsoRegisterStandard: alsoRegisterOther,
    };

    submitMutation.mutate({ data: payload });
  };

  const neonClass = accentColor === "primary" ? "neon-border" : "neon-border-cyan";
  const titleColor = accentColor === "primary"
    ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
    : "text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.5)]";
  const buttonVariant = accentColor === "primary" ? "default" : "secondary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`relative ${neonClass} bg-black/60`}>
        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
          <TerminalSquare className={`w-24 h-24 ${accentColor === "primary" ? "text-primary" : "text-secondary"}`} />
        </div>
        <CardHeader>
          <CardTitle className={titleColor}>{title}</CardTitle>
          <CardDescription className="text-muted-foreground/80">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Highlighted input section */}
            <div className={`rounded-xl border-2 p-4 space-y-4 ${
              accentColor === "primary"
                ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.12)]"
                : "border-secondary/50 bg-secondary/5 shadow-[0_0_20px_hsl(var(--secondary)/0.12)]"
            }`}>
              <div>
                <label className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                  accentColor === "primary" ? "text-primary" : "text-secondary"
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  Full Name
                </label>
                <Input
                  placeholder="e.g. Neo Anderson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`font-mono h-11 text-white placeholder:text-white/30 bg-black/40 border-2 ${
                    accentColor === "primary"
                      ? "border-primary/40 focus:border-primary focus:shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                      : "border-secondary/40 focus:border-secondary focus:shadow-[0_0_12px_hsl(var(--secondary)/0.4)]"
                  } focus:outline-none transition-all`}
                  disabled={submitMutation.isPending}
                />
              </div>

              <div>
                <label className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
                  accentColor === "primary" ? "text-primary" : "text-secondary"
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  Phone Number
                </label>
                <div className={`rounded-md border-2 overflow-hidden transition-all ${
                  accentColor === "primary"
                    ? "border-primary/40 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    : "border-secondary/40 focus-within:border-secondary focus-within:shadow-[0_0_12px_hsl(var(--secondary)/0.4)]"
                }`}>
                  <PhoneInput
                    international
                    defaultCountry="KE"
                    value={phone}
                    onChange={(val) => setPhone(val || "")}
                    disabled={submitMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {crossRegisterLabel && (
              <div className="flex items-center space-x-2 p-3 border border-border/50 rounded-md bg-background/30">
                <Checkbox
                  id={`cross-register-${type}`}
                  checked={alsoRegisterOther}
                  onCheckedChange={(checked) => setAlsoRegisterOther(!!checked)}
                  disabled={submitMutation.isPending}
                />
                <label
                  htmlFor={`cross-register-${type}`}
                  className="text-sm font-mono cursor-pointer"
                >
                  {crossRegisterLabel}
                </label>
              </div>
            )}

            {error && (
              <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-sm font-mono rounded-md">
                {'>'} ERR: {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-lg"
              variant={buttonVariant}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> PROCESSING...</>
              ) : (
                "INITIALIZE REGISTRATION"
              )}
            </Button>

            {type === "bot" && (
              <div className="rounded-xl border border-secondary/40 bg-secondary/8 p-4 space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-secondary shrink-0" />
                  <span className="text-xs font-bold font-mono uppercase tracking-widest text-secondary">
                    Bot Verification Steps
                  </span>
                </div>
                <ol className="space-y-2 text-xs font-mono text-muted-foreground leading-relaxed list-none">
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold shrink-0">1.</span>
                    <span>
                      Save admin's WhatsApp number below, then send him a message to prove you own a WhatsApp bot.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold shrink-0">2.</span>
                    <span>Fill in the form above and submit your registration.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-secondary font-bold shrink-0">3.</span>
                    <span>Admin will review your bot proof and approve your account.</span>
                  </li>
                </ol>
                <div className="flex flex-col items-center gap-1 pt-1 border-t border-secondary/20">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-secondary/70">
                    Admin WhatsApp — Save &amp; Text First
                  </span>
                  <CopyableNumber number="0713881613" size="lg" />
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
