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
import { Loader2, TerminalSquare } from "lucide-react";
import { motion } from "framer-motion";

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
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Full Name</label>
                <Input
                  placeholder="e.g. Neo Anderson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono"
                  disabled={submitMutation.isPending}
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Phone Number</label>
                <div className="relative">
                  <PhoneInput
                    international
                    defaultCountry="KE"
                    value={phone}
                    onChange={(val) => setPhone(val || "")}
                    disabled={submitMutation.isPending}
                  />
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
            </div>

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
              <p className="text-xs text-center text-muted-foreground font-mono mt-4">
                [SYSTEM NOTE] Admin will manually verify WhatsApp bot ownership before approval.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
