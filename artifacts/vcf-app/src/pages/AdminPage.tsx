import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useAdminLogin,
  useGetAdminRegistrations,
  useUpdateRegistrationStatus,
  useDeleteRegistration,
  getGetAdminRegistrationsQueryKey,
} from "@workspace/api-client-react";
import type { GetAdminRegistrationsType } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Terminal, Lock, CheckCircle, XCircle, LogOut, PauseCircle, Trash2, Settings, Save, Smartphone, Eye, CheckCheck, UserCheck, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

interface VcfSettings {
  standardTarget: number;
  botTarget: number;
  standardApproved: number;
  botApproved: number;
}

async function fetchSettings(): Promise<VcfSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json() as Promise<VcfSettings>;
}

async function updateTarget(
  token: string,
  type: "standard" | "bot",
  target: number,
): Promise<void> {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({ type, target }),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Failed to update target");
  }
}

export default function AdminPage() {
  const { isAuthenticated, token, login, logout, handleAuthError, sessionExpired } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const loginMutation = useAdminLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.success && data.token) {
          login(data.token);
        }
      },
      onError: (err: Error) => {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          setLoginError("ACCESS DENIED: Invalid username or password.");
        } else if (status === 500) {
          setLoginError(`SERVER ERROR: ${err.message}. Check that ADMIN_USERNAME and ADMIN_PASSWORD are set in your deployment environment.`);
        } else if (!status) {
          setLoginError(`NETWORK ERROR: Could not reach API. ${err.message}`);
        } else {
          setLoginError(`ERROR ${status}: ${err.message}`);
        }
      }
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    loginMutation.mutate({ data: { username, password } });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm neon-border">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-primary tracking-widest text-2xl drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]">
              ADMIN OVERRIDE
            </CardTitle>
            <CardDescription className="font-mono mt-2">Enter credentials to access the grid.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionExpired && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-mono text-amber-400">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>Session expired — please log in again to continue.</span>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                placeholder="USERNAME"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono text-center tracking-widest"
              />
              <Input
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-center tracking-widest"
              />
              {loginError && (
                <div className="text-destructive font-mono text-sm text-center bg-destructive/10 p-2 border border-destructive/50 rounded">
                  {'>'} {loginError}
                </div>
              )}
              <Button type="submit" className="w-full h-12" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "AUTHENTICATING..." : "INITIATE LOGIN"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-background pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-border/50 pb-6">
          <div className="flex items-center space-x-4">
            <Terminal className="w-8 h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-white">
              COMMAND <span className="text-primary">CENTER</span>
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="border-destructive/50 text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-2" /> DISCONNECT
          </Button>
        </header>

        {/* Settings Panel */}
        <TargetSettingsPanel token={token!} onAuthError={handleAuthError} />

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full sm:w-[576px] grid-cols-3 mb-8">
            <TabsTrigger value="standard">Standard VCF</TabsTrigger>
            <TabsTrigger value="bot">Bot VCF</TabsTrigger>
            <TabsTrigger value="payments">
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard" className="mt-0">
            <RegistrationTable type="standard" token={token!} onAuthError={handleAuthError} />
          </TabsContent>
          <TabsContent value="bot" className="mt-0 space-y-6">
            <BotVerifierPanel token={token!} onAuthError={handleAuthError} />
            <RegistrationTable type="bot" token={token!} onAuthError={handleAuthError} />
          </TabsContent>
          <TabsContent value="payments" className="mt-0">
            <PaymentsTable token={token!} onAuthError={handleAuthError} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TargetSettingsPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<VcfSettings>({
    queryKey: ["/api/settings"],
    queryFn: fetchSettings,
    refetchInterval: 10000,
  });

  const [stdTarget, setStdTarget] = useState<string>("");
  const [botTarget, setBotTarget] = useState<string>("");
  const [saveMsg, setSaveMsg] = useState<string>("");

  const stdValue = stdTarget !== "" ? stdTarget : String(settings?.standardTarget ?? "");
  const botValue = botTarget !== "" ? botTarget : String(settings?.botTarget ?? "");

  const updateMutation = useMutation({
    mutationFn: async ({ type, target }: { type: "standard" | "bot"; target: number }) => {
      await updateTarget(token, type, target);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setSaveMsg("TARGETS UPDATED");
      setTimeout(() => setSaveMsg(""), 3000);
      setStdTarget("");
      setBotTarget("");
    },
    onError: (err: Error) => {
      if ((err as { status?: number }).status === 401 || err.message.toLowerCase().includes("token")) {
        onAuthError();
        return;
      }
      setSaveMsg(`ERROR: ${err.message}`);
      setTimeout(() => setSaveMsg(""), 4000);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const std = parseInt(stdValue, 10);
    const bot = parseInt(botValue, 10);
    if (isNaN(std) || isNaN(bot) || std < 1 || bot < 1) {
      setSaveMsg("ERROR: Targets must be positive integers");
      setTimeout(() => setSaveMsg(""), 3000);
      return;
    }
    const promises: Promise<void>[] = [];
    if (std !== settings?.standardTarget) {
      promises.push(updateTarget(token, "standard", std));
    }
    if (bot !== settings?.botTarget) {
      promises.push(updateTarget(token, "bot", bot));
    }
    if (promises.length === 0) {
      setSaveMsg("NO CHANGES DETECTED");
      setTimeout(() => setSaveMsg(""), 2000);
      return;
    }
    updateMutation.mutate({ type: "standard", target: std });
    if (bot !== settings?.botTarget) {
      updateTarget(token, "bot", bot)
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/settings"] }))
        .catch(() => {});
    }
  };

  return (
    <Card className="border-t-4 border-t-primary/60 bg-black/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg tracking-widest">NETWORK TARGETS</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs">
          Set the verified-user target for each track. When a target is reached, users can download the VCF contacts file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="font-mono text-muted-foreground text-sm">LOADING TARGETS...</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold font-mono text-primary tracking-widest">
                STANDARD TARGET
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={stdValue}
                  onChange={(e) => setStdTarget(e.target.value)}
                  className="font-mono"
                  placeholder="e.g. 500"
                />
                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  ({settings?.standardApproved ?? 0} approved)
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold font-mono text-secondary tracking-widest">
                BOT TARGET
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={botValue}
                  onChange={(e) => setBotTarget(e.target.value)}
                  className="font-mono"
                  placeholder="e.g. 200"
                />
                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  ({settings?.botApproved ?? 0} approved)
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-10 px-6"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "SAVING..." : "SAVE TARGETS"}
              </Button>
              {saveMsg && (
                <span className={`text-xs font-mono ${saveMsg.startsWith("ERROR") ? "text-destructive" : "text-green-400"}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

interface BotVerifiedEntry {
  phone: string;
  verifiedAt: string;
  registrationId: number | null;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchBotVerified(token: string): Promise<{ entries: BotVerifiedEntry[]; total: number }> {
  const res = await fetch("/api/admin/bot-verified", { headers: { "x-admin-token": token } });
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
  return res.json() as Promise<{ entries: BotVerifiedEntry[]; total: number }>;
}

async function addBotVerified(token: string, phone: string): Promise<void> {
  const res = await fetch("/api/admin/bot-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Failed to add");
  }
}

async function removeBotVerified(token: string, phone: string): Promise<void> {
  const res = await fetch(`/api/admin/bot-verify/${encodeURIComponent(phone)}`, {
    method: "DELETE",
    headers: { "x-admin-token": token },
  });
  if (!res.ok) throw new Error("Failed to remove");
}

function BotVerifierPanel({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const queryClient = useQueryClient();
  const [newPhone, setNewPhone] = useState("");
  const [msg, setMsg] = useState("");

  const { data, isLoading, error: botError } = useQuery({
    queryKey: ["/api/admin/bot-verified"],
    queryFn: () => fetchBotVerified(token),
    refetchInterval: 8000,
    throwOnError: false,
  });

  useEffect(() => {
    if (botError && (botError as { status?: number }).status === 401) onAuthError();
  }, [botError]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-verified"] });

  const addMutation = useMutation({
    mutationFn: (phone: string) => addBotVerified(token, phone),
    onSuccess: () => {
      setNewPhone("");
      setMsg("PHONE ADDED ✓");
      setTimeout(() => setMsg(""), 3000);
      invalidate();
    },
    onError: (err: Error) => {
      setMsg(`ERROR: ${err.message}`);
      setTimeout(() => setMsg(""), 4000);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (phone: string) => removeBotVerified(token, phone),
    onSuccess: invalidate,
    onError: (err: Error) => {
      if ((err as { status?: number }).status === 401) onAuthError();
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const p = newPhone.trim();
    if (!p) return;
    addMutation.mutate(p);
  };

  const entries = data?.entries || [];

  return (
    <Card className="border-t-4 border-t-secondary bg-black/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-secondary" />
          <CardTitle className="text-lg tracking-widest text-secondary">BOT PHONE VERIFIER</CardTitle>
        </div>
        <CardDescription className="font-mono text-xs leading-relaxed">
          Enter a phone number to mark as bot-verified. Kenya: enter <span className="text-secondary">0712345678</span> or <span className="text-secondary">712345678</span>. Other countries: include + and country code, e.g. <span className="text-secondary">+447911123456</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold font-mono text-secondary tracking-widest">ADD VERIFIED BOT NUMBER</label>
            <input
              type="text"
              placeholder="e.g. 0712345678 · 712345678 · +447911123456"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full h-10 rounded-md border-2 border-secondary/40 bg-black/40 px-3 font-mono text-sm text-white placeholder:text-white/25 focus:border-secondary focus:outline-none focus:shadow-[0_0_10px_hsl(var(--secondary)/0.3)] transition-all"
              disabled={addMutation.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={addMutation.isPending || !newPhone.trim()}
            className="h-10 px-4 border-2 border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20 shadow-[0_0_8px_hsl(var(--secondary)/0.2)]"
            variant="ghost"
          >
            <Plus className="w-4 h-4 mr-1" />
            {addMutation.isPending ? "ADDING..." : "ADD"}
          </Button>
        </form>
        {msg && (
          <p className={`text-xs font-mono ${msg.startsWith("ERROR") ? "text-destructive" : "text-green-400"}`}>{msg}</p>
        )}

        {isLoading ? (
          <p className="text-xs font-mono text-muted-foreground">LOADING...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-6 text-xs font-mono text-muted-foreground border border-dashed border-secondary/20 rounded-lg">
            NO BOT-VERIFIED NUMBERS YET
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {entries.map((e) => (
              <div key={e.phone} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${e.registrationId ? "border-green-500/30 bg-green-500/5" : "border-secondary/25 bg-secondary/5"}`}>
                <div>
                  <span className="font-mono text-sm text-white font-bold">{e.phone}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Added {format(new Date(e.verifiedAt), "yyyy-MM-dd HH:mm")}
                    </span>
                    {e.registrationId ? (
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">REGISTERED</span>
                    ) : (
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">PENDING NAME</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeMutation.mutate(e.phone)}
                  disabled={removeMutation.isPending}
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PaymentConfirmation {
  id: number;
  name: string;
  phone: string;
  mpesaMessage: string;
  status: string;
  createdAt: string;
}

async function fetchPaymentConfirmations(token: string): Promise<{ confirmations: PaymentConfirmation[]; total: number }> {
  const res = await fetch("/api/admin/payment-confirmations", {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
  return res.json() as Promise<{ confirmations: PaymentConfirmation[]; total: number }>;
}

async function updatePaymentStatus(token: string, id: number, status: string): Promise<void> {
  await fetch(`/api/admin/payment-confirmations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ status }),
  });
}

async function deletePaymentConfirmation(token: string, id: number): Promise<void> {
  await fetch(`/api/admin/payment-confirmations/${id}`, {
    method: "DELETE",
    headers: { "x-admin-token": token },
  });
}

function PaymentsTable({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data, isLoading, error: paymentsError } = useQuery({
    queryKey: ["/api/admin/payment-confirmations"],
    queryFn: () => fetchPaymentConfirmations(token),
    refetchInterval: 8000,
    throwOnError: false,
  });

  useEffect(() => {
    if (paymentsError && (paymentsError as { status?: number }).status === 401) onAuthError();
  }, [paymentsError]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-confirmations"] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updatePaymentStatus(token, id, status),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePaymentConfirmation(token, id),
    onSuccess: () => { setConfirmDeleteId(null); invalidate(); },
  });

  const handleDelete = (id: number) => {
    if (confirmDeleteId === id) {
      deleteMutation.mutate(id);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "actioned") return <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">ACTIONED</span>;
    if (status === "reviewed") return <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">REVIEWED</span>;
    return <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">PENDING</span>;
  };

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center font-mono text-muted-foreground">LOADING PAYMENT DATA...</div>;
  }

  const confirmations = data?.confirmations || [];

  return (
    <Card className="border-t-4 border-t-amber-500/70 bg-black/40">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-amber-400" />
          M-Pesa Payment Confirmations
        </CardTitle>
        <CardDescription>
          Total Submissions: {data?.total || 0} — M-Pesa Number:{" "}
          <span className="font-bold text-amber-300 tracking-widest">0758891491</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {confirmations.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono border border-dashed border-amber-500/20 rounded-lg">
            NO PAYMENT CONFIRMATIONS YET
          </div>
        ) : (
          <div className="space-y-3">
            {confirmations.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border ${c.status === "actioned" ? "border-green-500/30 bg-green-500/5" : c.status === "reviewed" ? "border-blue-500/30 bg-blue-500/5" : "border-amber-500/30 bg-amber-500/5"} p-4 space-y-3`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{c.name}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                      <span>{c.phone}</span>
                      <span>•</span>
                      <span>{format(new Date(c.createdAt), "yyyy-MM-dd HH:mm")}</span>
                      <span>•</span>
                      <span className="text-muted-foreground/60">#{c.id.toString().padStart(4, "0")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground hover:text-white"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {expandedId === c.id ? "HIDE" : "VIEW"}
                    </Button>
                    {c.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        onClick={() => statusMutation.mutate({ id: c.id, status: "reviewed" })}
                        disabled={statusMutation.isPending}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> REVIEWED
                      </Button>
                    )}
                    {(c.status === "pending" || c.status === "reviewed") && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 px-2 bg-green-600 hover:bg-green-500 shadow-[0_0_8px_rgba(22,163,74,0.4)]"
                        onClick={() => statusMutation.mutate({ id: c.id, status: "actioned" })}
                        disabled={statusMutation.isPending}
                      >
                        <CheckCheck className="w-3.5 h-3.5 mr-1" /> ACTIONED
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={confirmDeleteId === c.id ? "destructive" : "ghost"}
                      className={`h-8 px-2 ${confirmDeleteId === c.id ? "animate-pulse" : "text-destructive/70 hover:text-destructive hover:bg-destructive/10"}`}
                      onClick={() => handleDelete(c.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {confirmDeleteId === c.id ? "CONFIRM?" : "DELETE"}
                    </Button>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="rounded border border-border/50 bg-background/40 px-3 py-2.5">
                    <p className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider mb-1.5">M-PESA MESSAGE</p>
                    <p className="text-sm font-mono text-white/90 whitespace-pre-wrap leading-relaxed">{c.mpesaMessage}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegistrationTable({ type, token, onAuthError }: { type: GetAdminRegistrationsType; token: string; onAuthError: () => void }) {
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data, isLoading, error: regError } = useGetAdminRegistrations(
    { type },
    {
      request: { headers: { "x-admin-token": token } },
      query: {
        queryKey: getGetAdminRegistrationsQueryKey({ type }),
        refetchInterval: 5000,
        throwOnError: false,
      },
    }
  );

  useEffect(() => {
    if (regError && (regError as { status?: number }).status === 401) onAuthError();
  }, [regError]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/verified"] });
    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
  };

  const updateMutation = useUpdateRegistrationStatus({
    request: { headers: { "x-admin-token": token } },
    mutation: {
      onSuccess: invalidateAll,
      onError: (err: unknown) => { if ((err as { status?: number }).status === 401) onAuthError(); },
    },
  });

  const deleteMutation = useDeleteRegistration({
    request: { headers: { "x-admin-token": token } },
    mutation: {
      onSuccess: () => {
        setConfirmDeleteId(null);
        invalidateAll();
      },
      onError: (err: unknown) => { if ((err as { status?: number }).status === 401) onAuthError(); },
    },
  });

  const handleUpdate = (id: number, status: "approved" | "rejected" | "suspended") => {
    updateMutation.mutate({ id, data: { status } });
  };

  const handleDelete = (id: number) => {
    if (confirmDeleteId === id) {
      deleteMutation.mutate({ id });
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  };

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center font-mono text-muted-foreground">SCANNING DATA...</div>;
  }

  const registrations = data?.registrations || [];

  return (
    <Card className={`border-t-4 ${type === "standard" ? "border-t-primary" : "border-t-secondary"} bg-black/40`}>
      <CardHeader>
        <CardTitle className="text-xl">
          {type === "standard" ? "Standard Protocol Log" : "Bot Owner Protocol Log"}
        </CardTitle>
        <CardDescription>Total Entries: {data?.total || 0}</CardDescription>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono border border-dashed border-border/50 rounded-lg">
            NO RECORDS FOUND FOR THIS CATEGORY
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target ID</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead>Comlink</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right min-w-[260px]">Overrides</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.id} className={reg.status === "suspended" ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-muted-foreground">#{reg.id.toString().padStart(4, "0")}</TableCell>
                    <TableCell className={`font-bold ${reg.status === "suspended" ? "line-through text-muted-foreground" : "text-white"}`}>
                      {reg.name}
                    </TableCell>
                    <TableCell className="font-mono">{reg.phone}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{reg.countryCode}</TableCell>
                    <TableCell className="font-mono text-xs">{format(new Date(reg.createdAt), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant={reg.status as "pending" | "approved" | "rejected" | "suspended"}>{reg.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {reg.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 px-2 bg-green-600 hover:bg-green-500 shadow-[0_0_10px_rgba(22,163,74,0.5)]"
                              onClick={() => handleUpdate(reg.id, "approved")}
                              disabled={updateMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> ALLOW
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2"
                              onClick={() => handleUpdate(reg.id, "rejected")}
                              disabled={updateMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> DENY
                            </Button>
                          </>
                        )}
                        {reg.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            onClick={() => handleUpdate(reg.id, "suspended")}
                            disabled={updateMutation.isPending}
                          >
                            <PauseCircle className="w-4 h-4 mr-1" /> SUSPEND
                          </Button>
                        )}
                        {reg.status === "suspended" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-2 bg-green-600 hover:bg-green-500"
                            onClick={() => handleUpdate(reg.id, "approved")}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> RESTORE
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={confirmDeleteId === reg.id ? "destructive" : "ghost"}
                          className={`h-8 px-2 ${confirmDeleteId === reg.id ? "animate-pulse" : "text-destructive/70 hover:text-destructive hover:bg-destructive/10"}`}
                          onClick={() => handleDelete(reg.id)}
                          disabled={deleteMutation.isPending}
                          title={confirmDeleteId === reg.id ? "Click again to confirm deletion" : "Delete permanently"}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {confirmDeleteId === reg.id ? "CONFIRM?" : "DELETE"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
