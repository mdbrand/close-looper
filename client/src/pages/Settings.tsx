import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Star, CheckCircle2, AlertCircle, Mic, ExternalLink, Database } from "lucide-react";
import { useLocation, useSearch } from "wouter";

export default function Settings() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const { data: gmailAccounts, refetch: refetchGmail } = trpc.gmail.list.useQuery();
  const { data: voiceProfile } = trpc.voice.get.useQuery();
  const { data: authUrl } = trpc.gmail.getAuthUrl.useQuery(undefined, {
    retry: false,
    enabled: true,
  });
  const { data: touchpointCount } = trpc.touchpoints.list.useQuery();

  const setDefaultMutation = trpc.gmail.setDefault.useMutation({
    onSuccess: () => { toast.success("Default account updated"); refetchGmail(); },
    onError: (e) => toast.error(e.message),
  });
  const disconnectMutation = trpc.gmail.disconnect.useMutation({
    onSuccess: () => { toast.success("Account disconnected"); refetchGmail(); },
    onError: (e) => toast.error(e.message),
  });
  const seedMutation = trpc.touchpoints.seed.useMutation({
    onSuccess: (data) => toast.success(`Seeded ${data.seeded} touchpoints!`),
    onError: (e) => toast.error(e.message),
  });

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("gmailSuccess")) {
      const email = params.get("email");
      toast.success(`Gmail connected: ${email}`);
      refetchGmail();
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("gmailError")) {
      toast.error(`Gmail error: ${params.get("gmailError")}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [search]);

  const isGmailConfigured = authUrl !== undefined;

  return (
    <div className="page-enter max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your Gmail accounts, AI voice, and app preferences.</p>
      </div>

      {/* Gmail Accounts */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Gmail Accounts</h2>
          </div>
          {isGmailConfigured && authUrl?.url ? (
            <Button size="sm" className="gap-1.5" onClick={() => window.location.href = authUrl.url}>
              <Plus className="w-3.5 h-3.5" /> Connect Gmail
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              Google OAuth not configured — add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to Secrets
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Connect your Gmail accounts. Emails will be sent directly from your real outbox for maximum deliverability.</p>
        {gmailAccounts && gmailAccounts.length > 0 ? (
          <div className="space-y-2">
            {gmailAccounts.map(account => (
              <div key={account.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                  {account.gmailAddress.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.gmailAddress}</p>
                  {account.isDefault && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Default account</p>}
                </div>
                <div className="flex gap-1.5">
                  {!account.isDefault && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setDefaultMutation.mutate({ id: account.id })}>
                      <Star className="w-3 h-3" /> Set default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => { if (confirm("Disconnect this account?")) disconnectMutation.mutate({ id: account.id }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No Gmail accounts connected yet. Connect one to start sending emails.
          </div>
        )}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-medium mb-1">How Gmail connection works</p>
          <p>Close Looper uses Gmail OAuth to send emails directly from your real outbox. This means emails land in the Primary inbox — not Promotions — because they come from your actual Gmail account.</p>
        </div>
      </section>

      {/* AI Voice Profile */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">AI Voice Profile</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setLocation("/voice-setup")} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> {voiceProfile ? "Update Voice" : "Set Up Voice"}
          </Button>
        </div>
        {voiceProfile ? (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Your voice sample</p>
              <p className="text-sm leading-relaxed line-clamp-4">{voiceProfile.voiceSample}</p>
            </div>
            {voiceProfile.styleNotes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">AI style analysis</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{voiceProfile.styleNotes}</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Voice profile active — all AI emails will match your style
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>No voice profile yet. Set one up so the AI writes in your exact tone.</p>
            <Button onClick={() => setLocation("/voice-setup")} className="mt-3 gap-1.5" size="sm">
              <Mic className="w-3.5 h-3.5" /> Set Up AI Voice
            </Button>
          </div>
        )}
      </section>

      {/* Touchpoint Data */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Touchpoint Library</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {touchpointCount ? `${touchpointCount.length} touchpoints loaded` : "No touchpoints loaded yet"} — includes US federal holidays, quirky national days, and industry-specific moments.
        </p>
        {(!touchpointCount || touchpointCount.length === 0) && (
          <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? "Loading..." : "Load Touchpoint Library"}
          </Button>
        )}
      </section>

      {/* Google OAuth Setup Instructions */}
      {!isGmailConfigured && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-amber-800">Gmail OAuth Setup Required</h2>
          </div>
          <p className="text-sm text-amber-700">To connect Gmail accounts, add these secrets in the Secrets panel:</p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li><code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> — from Google Cloud Console</li>
            <li><code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> — from Google Cloud Console</li>
            <li><code className="bg-amber-100 px-1 rounded">GOOGLE_REDIRECT_URI</code> — set to <code className="bg-amber-100 px-1 rounded">{window.location.origin}/api/gmail/callback</code></li>
          </ul>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-amber-700 underline">
            Open Google Cloud Console <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </section>
      )}
    </div>
  );
}

// Fix missing import
function Pencil({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );
}
