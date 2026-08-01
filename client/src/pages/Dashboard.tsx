import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Send, Mail, TrendingUp, Clock, Users, PauseCircle, AlertTriangle, ArrowRight, Inbox, Mic, Plus, Star } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color, onClick }: { icon: any; label: string; value: string | number; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-serif mt-1 text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color ?? "bg-primary/10"}`}>
          <Icon className={`w-5 h-5 ${color ? "text-white" : "text-primary"}`} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.analytics.stats.useQuery();
  const { data: needsAttention, isLoading: attentionLoading } = trpc.analytics.needsAttention.useQuery();
  const { data: pendingDrafts } = trpc.drafts.list.useQuery({ status: "pending" });
  const { data: topEngaged } = trpc.analytics.topEngaged.useQuery();
  const { data: sigStats } = trpc.signatures.stats.useQuery();
  const { data: voiceProfile } = trpc.voice.get.useQuery();
  const { data: pipeline } = trpc.analytics.pipeline.useQuery();

  return (
    <div className="page-enter max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your relationship nurturing at a glance</p>
      </div>

      {/* Onboarding nudges */}
      {!voiceProfile && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Set up your AI Voice Profile</p>
              <p className="text-xs text-muted-foreground">Write a few sentences the way you talk — the AI will match your exact tone on every email.</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setLocation("/voice-setup")} className="gap-1.5 shrink-0">
            Set Up <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Send} label="Sent This Month" value={stats.sentThisMonth} onClick={() => setLocation("/calendar")} />
          <StatCard icon={Mail} label="Sent All Time" value={stats.sentAllTime} onClick={() => setLocation("/calendar")} />
          <StatCard icon={TrendingUp} label="Open Rate" value={`${stats.openRate}%`} sub="of all sent emails" onClick={() => setLocation("/calendar")} />
          <StatCard icon={Clock} label="In Queue" value={stats.pendingCount} sub="drafts awaiting review" onClick={() => setLocation("/queue")} />
          <StatCard icon={Users} label="Active Contacts" value={stats.activeContacts} sub="in a loop" onClick={() => setLocation("/contacts")} />
          <StatCard icon={PauseCircle} label="Paused Contacts" value={stats.pausedContacts} sub="need follow-up" onClick={() => setLocation("/contacts")} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Needs Attention</h2>
          </div>
          {attentionLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !needsAttention || needsAttention.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">All caught up! No contacts need attention.</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.slice(0, 5).map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setLocation(`/contacts/${contact.id}`)}>
                  <div>
                    <p className="text-sm font-medium">{contact.firstName} {contact.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.loopStatus === "paused" ? "Loop paused — replied?" :
                       !contact.personalNotes ? "No personal notes yet" :
                       "No recent touch"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full status-${contact.loopStatus}`}>{contact.loopStatus}</span>
                </div>
              ))}
              {needsAttention.length > 5 && (
                <button onClick={() => setLocation("/contacts")} className="text-xs text-primary hover:underline w-full text-center pt-1">
                  +{needsAttention.length - 5} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pending Queue Preview */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Approval Queue</h2>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setLocation("/queue")}>
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          {!pendingDrafts || pendingDrafts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Queue is empty</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setLocation("/contacts")}>
                <Plus className="w-3.5 h-3.5" /> Add contacts to get started
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDrafts.slice(0, 4).map(draft => (
                <div key={draft.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                    {draft.contact?.firstName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{draft.contact?.firstName} {draft.contact?.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{draft.subject}</p>
                  </div>
                </div>
              ))}
              {pendingDrafts.length > 4 && (
                <button onClick={() => setLocation("/queue")} className="text-xs text-primary hover:underline w-full text-center pt-1">
                  +{pendingDrafts.length - 4} more in queue
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {topEngaged && topEngaged.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Top Engaged Contacts</h2>
          </div>
          <div className="space-y-2">
            {topEngaged.map(item => (
              <div key={item.contactId} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setLocation(`/contacts/${item.contactId}`)}>
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-semibold shrink-0">
                  {item.contact?.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.contact?.firstName} {item.contact?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{item.emailsSent} emails sent</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-600">{item.totalOpens}</p>
                  <p className="text-xs text-muted-foreground">opens</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature A/B Testing */}
      {/* Relationship Pipeline */}
      {pipeline && (pipeline.cold > 0 || pipeline.warm > 0 || pipeline.hot > 0) && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-primary" /> Relationship Pipeline</h3>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 text-center">
              <div className="w-full bg-blue-100 rounded-lg py-3">
                <p className="text-2xl font-serif text-blue-700">{pipeline.cold}</p>
                <p className="text-xs text-blue-600 mt-0.5">Cold</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 text-center">
              <div className="w-full bg-amber-100 rounded-lg py-3">
                <p className="text-2xl font-serif text-amber-700">{pipeline.warm}</p>
                <p className="text-xs text-amber-600 mt-0.5">Warm</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 text-center">
              <div className="w-full bg-red-100 rounded-lg py-3">
                <p className="text-2xl font-serif text-red-700">{pipeline.hot}</p>
                <p className="text-xs text-red-600 mt-0.5">Hot</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="font-medium text-foreground text-sm">{pipeline.inSequence}</p>
              <p>In Sequences</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="font-medium text-foreground text-sm">{pipeline.inTouchpoints}</p>
              <p>In Touchpoints</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="font-medium text-foreground text-sm">{pipeline.sequenceCompletions}</p>
              <p>Completions</p>
            </div>
          </div>
        </div>
      )}

      {sigStats && sigStats.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-primary" /> Signature A/B Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sigStats.map((sig: any) => (
              <div key={sig.id} className={`border rounded-lg p-3 ${sig.isDefault ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{sig.name}</p>
                  {sig.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{sig.sendCount} sent</span>
                  <span>{sig.replyCount} replies</span>
                  <span className="font-medium text-foreground">{sig.replyRate}% reply rate</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
