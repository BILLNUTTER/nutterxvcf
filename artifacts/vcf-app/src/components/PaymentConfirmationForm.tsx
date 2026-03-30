import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MPESA_NUMBER = "0758891491";
const ADMIN_WHATSAPP = "+254713881613";

interface SubmitPayload {
  name: string;
  phone: string;
  mpesaMessage: string;
}

async function submitPaymentConfirmation(data: SubmitPayload): Promise<void> {
  const res = await fetch("/api/payment-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Submission failed");
  }
}

export function PaymentConfirmationForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mpesaMessage, setMpesaMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: submitPaymentConfirmation,
    onSuccess: () => {
      setSubmitted(true);
      setName("");
      setPhone("");
      setMpesaMessage("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !mpesaMessage.trim()) return;
    mutation.mutate({ name: name.trim(), phone: phone.trim(), mpesaMessage: mpesaMessage.trim() });
  };

  return (
    <Card className="border-t-4 border-t-amber-500/70 bg-black/40 backdrop-blur-md border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-amber-400" />
          <CardTitle className="text-lg tracking-widest text-amber-300">
            M-PESA PAYMENT CONFIRMATION
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-xs leading-relaxed mt-1">
          After sending payment, paste your M-Pesa confirmation message below so admin can verify you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* M-Pesa number highlight */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg bg-amber-500/10 border border-amber-500/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-mono text-amber-200">
              Send <span className="font-bold text-white">Ksh. 10</span> to M-Pesa number:
            </span>
          </div>
          <span className="text-xl font-bold tracking-widest text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
            {MPESA_NUMBER}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="w-12 h-12 text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
              <div>
                <p className="font-bold text-green-300 tracking-widest text-sm">CONFIRMATION RECEIVED</p>
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Admin will verify your payment and approve your registration.
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Questions?{" "}
                  <a
                    href={`https://wa.me/${ADMIN_WHATSAPP.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  >
                    Chat with admin
                  </a>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-mono"
                onClick={() => setSubmitted(false)}
              >
                SUBMIT ANOTHER
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold font-mono text-amber-300/80 uppercase tracking-wider">
                    Full Name
                  </label>
                  <Input
                    placeholder="Your registered name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="font-mono border-amber-500/30 focus:border-amber-500/70 bg-black/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold font-mono text-amber-300/80 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <Input
                    placeholder="e.g. 0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="font-mono border-amber-500/30 focus:border-amber-500/70 bg-black/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold font-mono text-amber-300/80 uppercase tracking-wider">
                  M-Pesa Confirmation Message
                </label>
                <textarea
                  placeholder={"Paste the full SMS you received from M-Pesa after sending payment...\n\nExample:\nYFYFYFYFYF Confirmed. Ksh10.00 sent to NUTTERX ADMIN 0758891491 on 30/3/24 at 8:00 AM. New M-PESA balance is Ksh1,000.00."}
                  value={mpesaMessage}
                  onChange={(e) => setMpesaMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full rounded-md border border-amber-500/30 focus:border-amber-500/70 bg-black/30 px-3 py-2 text-sm font-mono text-white placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition"
                />
              </div>

              {mutation.isError && (
                <p className="text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
                  {'>'} {(mutation.error as Error).message}
                </p>
              )}

              <Button
                type="submit"
                disabled={mutation.isPending || !name.trim() || !phone.trim() || !mpesaMessage.trim()}
                className="w-full h-11 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 font-bold tracking-widest shadow-[0_0_10px_rgba(251,191,36,0.2)]"
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> SUBMITTING...</>
                ) : (
                  "SUBMIT PAYMENT PROOF"
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
