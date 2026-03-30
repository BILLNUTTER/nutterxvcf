import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminLogin, useGetAdminRegistrations, useUpdateRegistrationStatus } from "@workspace/api-client-react";
import { GetAdminRegistrationsType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Terminal, Lock, CheckCircle, XCircle, LogOut } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminPage() {
  const { isAuthenticated, token, login, logout } = useAuth();
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
      onError: () => {
        setLoginError("ACCESS DENIED: Invalid credentials.");
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

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full sm:w-96 grid-cols-2 mb-8">
            <TabsTrigger value="standard">Standard VCF</TabsTrigger>
            <TabsTrigger value="bot">Bot VCF</TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="mt-0">
            <RegistrationTable type="standard" token={token!} />
          </TabsContent>
          <TabsContent value="bot" className="mt-0">
            <RegistrationTable type="bot" token={token!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RegistrationTable({ type, token }: { type: GetAdminRegistrationsType, token: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAdminRegistrations(
    { type },
    { request: { headers: { "x-admin-token": token } }, query: { refetchInterval: 5000 } }
  );

  const updateMutation = useUpdateRegistrationStatus({
    request: { headers: { "x-admin-token": token } },
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/registrations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/verified"] });
      }
    }
  });

  const handleUpdate = (id: number, status: "approved" | "rejected") => {
    updateMutation.mutate({ id, data: { status } });
  };

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center font-mono text-muted-foreground">SCANNING DATA...</div>;
  }

  const registrations = data?.registrations || [];

  return (
    <Card className={`border-t-4 ${type === 'standard' ? 'border-t-primary' : 'border-t-secondary'} bg-black/40`}>
      <CardHeader>
        <CardTitle className="text-xl">
          {type === 'standard' ? 'Standard Protocol Log' : 'Bot Owner Protocol Log'}
        </CardTitle>
        <CardDescription>Total Entries: {data?.total || 0}</CardDescription>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono border border-dashed border-border/50 rounded-lg">
            NO RECORDS FOUND FOR THIS CATEGORY
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target ID</TableHead>
                <TableHead>Identity</TableHead>
                <TableHead>Comlink</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Overrides</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-mono text-muted-foreground">#{reg.id.toString().padStart(4, '0')}</TableCell>
                  <TableCell className="font-bold text-white">{reg.name}</TableCell>
                  <TableCell className="font-mono">{reg.phone}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{reg.countryCode}</TableCell>
                  <TableCell className="font-mono text-xs">{format(new Date(reg.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                  <TableCell>
                    <Badge variant={reg.status as any}>{reg.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {reg.status === 'pending' && (
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
