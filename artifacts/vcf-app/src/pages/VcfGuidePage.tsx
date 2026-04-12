import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Download,
  Mail,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";

function getType(): "standard" | "bot" {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("type");
  return t === "bot" ? "bot" : "standard";
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function VcfGuidePage() {
  const [, setLocation] = useLocation();
  const type = getType();
  const downloadUrl = `/api/vcf/download?type=${type}`;

  const [androidOpen, setAndroidOpen] = useState(true);
  const [iosOpen, setIosOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const handleDownload = () => {
    window.open(downloadUrl, "_blank");
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img
          src={`${BASE}/images/hero-bg.png`}
          alt=""
          className="w-full h-full object-cover opacity-10 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-6">

        {/* Back */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO SYSTEM
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            TARGET REACHED — CONTACTS UNLOCKED
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter text-white">
            DOWNLOAD &amp; SAVE{" "}
            <span className="text-primary">VCF CONTACTS</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            {type === "standard" ? "Standard VCF Network" : "WhatsApp Bot VCF Network"} — Follow the guide below to save all contacts to your phone.
          </p>
        </motion.div>

        {/* Download Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-primary/40 bg-black/50 backdrop-blur-md p-6 space-y-4 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-white tracking-wide">STEP 1 — Download the VCF File</p>
              <p className="text-xs text-muted-foreground font-mono">Tap the button below to download the contacts file to your device.</p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
          >
            <Download className="w-5 h-5" />
            DOWNLOAD VCF FILE
          </button>

          <p className="text-center text-[11px] font-mono text-muted-foreground">
            The file will download as <span className="text-white">contacts.vcf</span> — keep it somewhere easy to find.
          </p>
        </motion.div>

        {/* Step 2 Header */}
        <div className="flex items-center gap-2 px-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold tracking-widest text-primary uppercase">
            STEP 2 — Import to Your Contacts App
          </span>
        </div>

        {/* Android Guide */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-green-500/30 bg-black/40 backdrop-blur-md overflow-hidden"
        >
          <button
            onClick={() => setAndroidOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-green-400" />
              <span className="font-bold text-white tracking-wide">Android</span>
            </div>
            {androidOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {androidOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-green-500/20">
              <StepItem n={1} text='Open your <strong>Files</strong> or <strong>Downloads</strong> app and find the downloaded <code>contacts.vcf</code> file.' />
              <StepItem n={2} text='Tap the file — your phone will ask which app to open it with.' />
              <StepItem n={3} text='Select <strong>Contacts</strong> (or Google Contacts).' />
              <StepItem n={4} text='Tap <strong>Import</strong> and choose which account to save to (e.g. your Google account).' />
              <StepItem n={5} text='All contacts are now saved to your phone.' />

              <div className="mt-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5">
                <p className="text-[11px] font-mono text-green-300/80">
                  <span className="font-bold text-green-300">Tip:</span> If the file doesn't open automatically, go to <strong>Google Contacts → Fix &amp; Manage → Import from file</strong> and pick the VCF file.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* iOS Guide */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-blue-500/30 bg-black/40 backdrop-blur-md overflow-hidden"
        >
          <button
            onClick={() => setIosOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white tracking-wide">iPhone (iOS)</span>
            </div>
            {iosOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {iosOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-blue-500/20">
              <StepItem n={1} text='Tap the download button above. Safari will show a <strong>Download</strong> icon in the toolbar — tap it.' />
              <StepItem n={2} text='Tap the downloaded <code>contacts.vcf</code> file.' />
              <StepItem n={3} text='iOS will ask if you want to import contacts — tap <strong>Add All X Contacts</strong>.' />
              <StepItem n={4} text='All contacts are now saved to your iPhone.' />

              <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
                <p className="text-[11px] font-mono text-blue-300/80">
                  <span className="font-bold text-blue-300">Alternative:</span> Use the email method below — email the file to yourself and open it on your iPhone.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Email method */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-amber-500/30 bg-black/40 backdrop-blur-md overflow-hidden"
        >
          <button
            onClick={() => setEmailOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-white tracking-wide">Email Method (works on all phones)</span>
            </div>
            {emailOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {emailOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-amber-500/20">
              <StepItem n={1} text='Download the VCF file to your computer or phone using the button above.' />
              <StepItem n={2} text='Send it as an <strong>email attachment</strong> to your own email address.' />
              <StepItem n={3} text='On your phone, open the email and tap the attachment.' />
              <StepItem n={4} text='Your phone will prompt you to import the contacts — tap <strong>Import</strong> or <strong>Add to Contacts</strong>.' />

              <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                <p className="text-[11px] font-mono text-amber-300/80">
                  <span className="font-bold text-amber-300">Why email?</span> This is the easiest cross-platform method and works on any smartphone or tablet.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Support footer */}
        <div className="text-center pt-2">
          <p className="text-xs font-mono text-muted-foreground">
            Need help?{" "}
            <a
              href="https://wa.me/254758891491"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Contact support: +254 758 891491
            </a>
          </p>
        </div>

      </div>

      {/* Fixed bottom bar — repeat download CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md border-t border-border z-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD VCF CONTACTS
          </button>
        </div>
      </div>
    </div>
  );
}

function StepItem({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3 pt-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold font-mono flex items-center justify-center mt-0.5">
        {n}
      </span>
      <p
        className="text-sm text-white/80 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}
