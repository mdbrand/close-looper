import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Star, CheckCircle2, AlertCircle, Mic, ExternalLink, Database, Activity, Zap, Ban, Rocket } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ONBOARDING_SKIPPED_KEY } from "@/lib/onboarding";

export default function Settings() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const { data: usageStats } = trpc.usage.stats.useQuery();
  const { data: gmailAccounts, refetch: refetchGmail } = trpc.gmail.list.useQuery();
  const { data: voiceProfile } = trpc.voice.get.useQuery();
  const { data: authUrl } = trpc.gmail.getAuthUrl.useQuery(undefined, {
    retry: false,
    enabled: true,
  });
  const { data: touchpointCount } = trpc.touchpoints.list.useQuery();
  const { data: onboarding } = trpc.onboarding.status.useQuery();
  const { data: suppressed, refetch: refetchSuppressed } = trpc.suppression.list.useQuery();

  const [resubscribing, setResubscribing] = useState<string | null>(null);
  const removeSuppression = trpc.suppression.remove.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.reactivatedContacts > 0
          ? "Removed from Do Not Email — their loop is active again."
          : "Removed from Do Not Email."
      );
      setResubscribing(null);
      refetchSuppressed();
    },
    onError: (e) => { toast.error(e.message); setResubscribing(null); },
  });

  const setDefaultMutation = trpc.gmail.setDefault.useMutation({
    onSuccess: () => { toast.success("Default account updated"); refetchGmail(); },
    onError: (e) => toast.error(e.message),
  });
  const disconnectMutation = trpc.gmail.disconnect.useMutation({
    onSuccess: () => { toast.success("Account disconnected"); refetchGmail(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSenderNameMutation = trpc.gmail.updateSenderName.useMutation({
    onSuccess: () => { toast.success("Sender name updated"); refetchGmail(); },
    onError: (e) => toast.error(e.message),
  });
  const seedMutation = trpc.touchpoints.seed.useMutation({
    onSuccess: (data) => toast.success(`Seeded ${data.seeded} touchpoints!`),
    onError: (e) => toast.error(e.message),
  });

  const [showNewSig, setShowNewSig] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigContent, setSigContent] = useState("");
  const [editingSig, setEditingSig] = useState<any>(null);
  const { data: signatures, refetch: refetchSigs } = trpc.signatures.list.useQuery();
  const createSigMutation = trpc.signatures.create.useMutation({
    onSuccess: () => { toast.success("Signature created"); setShowNewSig(false); setSigName(""); setSigContent(""); refetchSigs(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSigMutation = trpc.signatures.update.useMutation({
    onSuccess: () => { toast.success("Signature updated"); setEditingSig(null); refetchSigs(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSigMutation = trpc.signatures.delete.useMutation({
    onSuccess: () => { toast.success("Signature deleted"); refetchSigs(); },
    onError: (e) => toast.error(e.message),
  });
  const setDefaultSigMutation = trpc.signatures.setDefault.useMutation({
    onSuccess: () => { toast.success("Default signature updated"); refetchSigs(); },
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
                  <p className="text-sm font-medium truncate">{account.senderName ? `${account.senderName} (${account.gmailAddress})` : account.gmailAddress}</p>
                  {!account.senderName && <p className="text-xs text-amber-600">Set a sender name below</p>}
                  {account.isDefault && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Default account</p>}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => {
                    const name = prompt("Enter sender name (e.g., Rob Cooley):", account.senderName || "");
                    if (name !== null) updateSenderNameMutation.mutate({ id: account.id, senderName: name });
                  }}>
                    Edit Name
                  </Button>
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

      {/* Email Signatures */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Email Signatures</h2>
          <Button size="sm" variant="outline" onClick={() => setShowNewSig(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Signature
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Create multiple signatures with persuasive copy. The default signature auto-appends to every outgoing email.</p>

        {showNewSig && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
            <input
              placeholder="Signature name (e.g., Referral Partners, Casual)"
              value={sigName}
              onChange={e => setSigName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
            <textarea
              placeholder="Your signature content...&#10;&#10;Example:&#10;Rob Cooley&#10;Cooley Brothers | Keeping your home comfortable&#10;📞 (555) 123-4567&#10;💬 Reply to this email — I read every one"
              value={sigContent}
              onChange={e => setSigContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createSigMutation.mutate({ name: sigName, content: sigContent, isDefault: !signatures?.length })} disabled={!sigName || !sigContent || createSigMutation.isPending}>
                {createSigMutation.isPending ? "Saving..." : "Save Signature"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewSig(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {signatures && signatures.length > 0 ? (
          <div className="space-y-2">
            {signatures.map(sig => (
              <div key={sig.id} className="border border-border rounded-lg p-4">
                {editingSig?.id === sig.id ? (
                  <div className="space-y-3">
                    <input value={editingSig.name} onChange={e => setEditingSig({ ...editingSig, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                    <textarea value={editingSig.content} onChange={e => setEditingSig({ ...editingSig, content: e.target.value })} rows={4} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateSigMutation.mutate({ id: sig.id, name: editingSig.name, content: editingSig.content })} disabled={updateSigMutation.isPending}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingSig(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{sig.name}</p>
                        {sig.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                      </div>
                      <div className="flex gap-1">
                        {!sig.isDefault && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDefaultSigMutation.mutate({ id: sig.id })} disabled={setDefaultSigMutation.isPending}>Set Default</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSig({ ...sig })}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { if (confirm("Delete this signature?")) deleteSigMutation.mutate({ id: sig.id }); }}>Delete</Button>
                      </div>
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-3">{sig.content}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !showNewSig ? (
         <p className="text-sm text-muted-foreground">No signatures yet. Create one to auto-append to your emails.</p>
       ) : null}
     </section>

      {/* AI Credit Usage */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">AI Credit Usage</h2>
        </div>
        {usageStats ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-serif">{usageStats.thisMonth.calls}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Calls This Month</p>
                <p className="text-xs text-muted-foreground">{usageStats.thisMonth.totalTokens.toLocaleString()} tokens</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-serif">{usageStats.lastMonth.calls}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Last Month</p>
                <p className="text-xs text-muted-foreground">{usageStats.lastMonth.totalTokens.toLocaleString()} tokens</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-serif">{usageStats.allTime.calls}</p>
                <p className="text-xs text-muted-foreground mt-0.5">All Time</p>
                <p className="text-xs text-muted-foreground">{usageStats.allTime.totalTokens.toLocaleString()} tokens</p>
              </div>
            </div>
            {usageStats.byAction.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Action</p>
                <div className="space-y-2">
                  {usageStats.byAction.map((a: any) => (
                    <div key={a.action} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-sm capitalize">{a.action.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">{a.calls} calls</span>
                        <span className="text-xs text-muted-foreground ml-2">({a.totalTokens.toLocaleString()} tokens)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {usageStats.dailyBreakdown.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Last 30 Days</p>
                <div className="flex items-end gap-0.5 h-16">
                  {usageStats.dailyBreakdown.map((d: any) => {
                    const maxCalls = Math.max(...usageStats.dailyBreakdown.map((x: any) => x.calls), 1);
                    const height = Math.max((d.calls / maxCalls) * 100, 4);
                    return (
                      <div
                        key={d.date}
                        className="flex-1 bg-primary/60 rounded-t-sm hover:bg-primary transition-colors"
                        style={{ height: `${height}%` }}
                        title={`${d.date}: ${d.calls} calls, ${d.totalTokens} tokens`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{usageStats.dailyBreakdown[0]?.date}</span>
                  <span>{usageStats.dailyBreakdown[usageStats.dailyBreakdown.length - 1]?.date}</span>
                </div>
              </div>
            )}
            {usageStats.allTime.calls === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No AI usage recorded yet. Credits will be tracked as you generate emails.</p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="h-20 bg-muted/30 rounded-lg animate-pulse" />
            <div className="h-12 bg-muted/30 rounded-lg animate-pulse" />
          </div>
        )}
      </section>

      {/* Suppression list — unsubscribing used to be a one-way door with no way
          back short of a database edit. */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Do Not Email</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          People who unsubscribed or whose address bounced. Close Looper will never send to these addresses.
        </p>

        {suppressed === undefined ? (
          <div className="h-12 bg-muted/30 rounded-lg animate-pulse" />
        ) : suppressed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nobody is on this list. That is a good sign.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg">
            {suppressed.map(entry => (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {entry.reason} · {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setResubscribing(entry.email)}>
                  Allow again
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={resubscribing !== null} onOpenChange={open => !open && setResubscribing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start emailing {resubscribing} again?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from your Do Not Email list and sets their contact loop back to active, so
              they will start receiving your emails again. Only do this if they have asked to hear from you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (resubscribing) removeSuppression.mutate({ email: resubscribing }); }}
            >
              Yes, allow emails again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Setup — skipping the wizard is sticky, so this is the only way back. */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Setup</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {onboarding && !onboarding.isComplete
            ? `You have finished ${onboarding.completedCount} of ${onboarding.totalSteps} setup steps.`
            : "Your setup is complete. You can walk through it again any time."}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
            setLocation("/welcome");
          }}
        >
          {onboarding && !onboarding.isComplete ? "Finish setup" : "Review setup"}
        </Button>
      </section>

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
