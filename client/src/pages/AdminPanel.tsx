import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Mail, Key, Share2, BarChart3, CheckCircle2, XCircle, Plus, Copy, Power } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPanel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"overview"|"waitlist"|"users"|"invites"|"referrals">("overview");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);

  const { data: stats } = trpc.admin.stats.useQuery(undefined, { enabled: user?.role === "admin" });
  const { data: waitlist, refetch: refetchWaitlist } = trpc.admin.listWaitlist.useQuery(undefined, { enabled: tab === "waitlist" && user?.role === "admin" });
  const { data: allUsers } = trpc.admin.listUsers.useQuery(undefined, { enabled: tab === "users" && user?.role === "admin" });
  const { data: inviteCodes, refetch: refetchInvites } = trpc.admin.listInviteCodes.useQuery(undefined, { enabled: tab === "invites" && user?.role === "admin" });
  const { data: referrals } = trpc.admin.listReferrals.useQuery(undefined, { enabled: tab === "referrals" && user?.role === "admin" });

  const approveMutation = trpc.admin.approveWaitlist.useMutation({ onSuccess: () => { toast.success("Approved!"); refetchWaitlist(); } });
  const rejectMutation = trpc.admin.rejectWaitlist.useMutation({ onSuccess: () => { toast.success("Rejected."); refetchWaitlist(); } });
  const createInviteMutation = trpc.admin.createInviteCode.useMutation({ onSuccess: (d) => { toast.success(`Invite code created: ${d.code}`); refetchInvites(); setInviteNote(""); } });
  const deactivateMutation = trpc.admin.deactivateInviteCode.useMutation({ onSuccess: () => { toast.success("Code deactivated."); refetchInvites(); } });

  if (user?.role !== "admin") {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Admin only.</div>;
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "waitlist", label: "Waitlist", icon: <Mail className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { id: "invites", label: "Invite Codes", icon: <Key className="w-4 h-4" /> },
    { id: "referrals", label: "Referrals", icon: <Share2 className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="page-enter max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage users, waitlist, invite codes, and referrals</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-muted/30 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Total Users", value: stats?.totalUsers ?? "—", color: "text-blue-600" },
            { label: "Waitlist Total", value: stats?.totalWaitlist ?? "—", color: "text-purple-600" },
            { label: "Pending Review", value: stats?.pendingWaitlist ?? "—", color: "text-amber-600" },
            { label: "Active Invite Codes", value: stats?.activeInvites ?? "—", color: "text-green-600" },
            { label: "Total Referrals", value: stats?.totalReferrals ?? "—", color: "text-rose-600" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-3xl font-serif font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Waitlist */}
      {tab === "waitlist" && (
        <div className="space-y-3">
          {!waitlist?.length && <p className="text-muted-foreground text-sm">No signups yet.</p>}
          {waitlist?.map((w: any) => (
            <div key={w.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{w.firstName} {w.lastName}</p>
                    <Badge variant={w.status === "approved" ? "default" : w.status === "rejected" ? "destructive" : "secondary"} className="text-xs">{w.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{w.email} · {w.phone}</p>
                  <p className="text-sm text-muted-foreground">{w.companyName} · {w.industry}</p>
                  {w.website && <p className="text-xs text-muted-foreground">{w.website}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Success metric: <em>{w.successMetric}</em></p>
                  {w.inviteCode && <p className="text-xs text-muted-foreground">Invite code: {w.inviteCode}</p>}
                  {w.referredByCode && <p className="text-xs text-muted-foreground">Referred by: {w.referredByCode}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => approveMutation.mutate({ id: w.id })} className="gap-1 bg-green-600 hover:bg-green-700 text-white"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate({ id: w.id })} className="gap-1 text-red-600 border-red-200 hover:bg-red-50"><XCircle className="w-3.5 h-3.5" /> Reject</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="space-y-3">
          {!allUsers?.length && <p className="text-muted-foreground text-sm">No users yet.</p>}
          {allUsers?.map((u: any) => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-medium">{u.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">Joined {new Date(u.createdAt).toLocaleDateString()} · Role: {u.role}</p>
                {u.profile && <p className="text-xs text-muted-foreground">{u.profile.companyName} · {u.profile.industry} · {u.profile.subscriptionStatus}</p>}
              </div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Invite Codes */}
      {tab === "invites" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-medium mb-3">Create New Invite Code</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
                <Input value={inviteNote} onChange={e => setInviteNote(e.target.value)} placeholder="e.g. For chamber event" />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Max Uses</label>
                <Input type="number" min={1} value={inviteMaxUses} onChange={e => setInviteMaxUses(Number(e.target.value))} />
              </div>
              <Button onClick={() => createInviteMutation.mutate({ maxUses: inviteMaxUses, note: inviteNote })} disabled={createInviteMutation.isPending} className="gap-1.5">
                <Plus className="w-4 h-4" /> Generate
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {!inviteCodes?.length && <p className="text-muted-foreground text-sm">No invite codes yet.</p>}
            {inviteCodes?.map((c: any) => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-sm">{c.code}</code>
                    <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs">{c.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.useCount}/{c.maxUses} uses · {c.note ?? "No note"} · Created {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }} className="gap-1"><Copy className="w-3.5 h-3.5" /></Button>
                  {c.isActive && <Button size="sm" variant="ghost" onClick={() => deactivateMutation.mutate({ id: c.id })} className="gap-1 text-red-500"><Power className="w-3.5 h-3.5" /></Button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals */}
      {tab === "referrals" && (
        <div className="space-y-3">
          {!referrals?.length && <p className="text-muted-foreground text-sm">No referrals yet.</p>}
          {referrals?.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Code: <code className="font-mono">{r.referralCode}</code></p>
                <p className="text-xs text-muted-foreground">{r.referredEmail ?? "No email yet"} · Status: {r.status}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge variant={r.status === "credited" ? "default" : r.status === "paid" ? "secondary" : "outline"} className="text-xs">{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
