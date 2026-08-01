import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Copy, Plus, RotateCcw, ChevronRight, Users, CheckCircle2, Zap } from "lucide-react";

export default function Sequences() {
  const { data: seqs, isLoading, refetch } = trpc.sequences.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: detail } = trpc.sequences.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const seedMutation = trpc.sequences.seed.useMutation({ onSuccess: () => { toast.success("Cold Sequence created!"); refetch(); }, onError: (e: any) => toast.error(e.message) });
  const duplicateMutation = trpc.sequences.duplicate.useMutation({ onSuccess: () => { toast.success("Sequence duplicated!"); refetch(); }, onError: (e: any) => toast.error(e.message) });
  const restoreMutation = trpc.sequences.restoreDefault.useMutation({ onSuccess: () => { toast.success("Default restored!"); refetch(); setSelectedId(null); }, onError: (e: any) => toast.error(e.message) });
  const updateStepMutation = trpc.sequences.updateStep.useMutation({ onSuccess: () => toast.success("Step saved!"), onError: (e: any) => toast.error(e.message) });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  // Detail view
  if (selectedId && detail) {
    return (
      <div className="page-enter max-w-4xl">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Sequences
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif">{detail.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{detail.description}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate({ id: detail.id })} className="gap-1.5"><Copy className="w-3.5 h-3.5" /> Duplicate</Button>
            {detail.isDefault && <Button variant="outline" size="sm" onClick={() => restoreMutation.mutate()} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Restore Default</Button>}
          </div>
        </div>
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${detail.relationshipTier === "cold" ? "bg-blue-100 text-blue-700" : detail.relationshipTier === "warm" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{detail.relationshipTier}</span>
          <span>{detail.totalSteps} steps</span>
          <span>{detail.isActive ? "Active" : "Inactive"}</span>
        </div>
        <div className="space-y-4">
          {detail.steps?.map((step: any) => (
            <div key={step.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{step.stepNumber}</span>
                  <h3 className="font-medium">{step.internalName}</h3>
                </div>
                <span className="text-xs text-muted-foreground">Month {step.stepNumber}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Relationship Objective</p>
                  <p className="text-sm">{step.relationshipObjective}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Desired Thought</p>
                  <p className="text-sm italic">{step.desiredRecipientThought}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email Guidance</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.emailGuidance}</p>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Closing: {step.suggestedClosing}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="page-enter max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Sequences</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your relationship-building email sequences</p>
        </div>
        <div className="flex gap-2">
          {(!seqs || seqs.length === 0) && (
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-1.5">
              <Zap className="w-4 h-4" /> {seedMutation.isPending ? "Creating..." : "Create Cold Sequence"}
            </Button>
          )}
        </div>
      </div>

      {(!seqs || seqs.length === 0) ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">No sequences yet</p>
          <p className="text-sm">Create the built-in Cold Relationship Sequence to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {seqs.map((seq: any) => (
            <div key={seq.id} onClick={() => setSelectedId(seq.id)} className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-medium">{seq.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{seq.description?.slice(0, 80)}...</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full font-medium ${seq.relationshipTier === "cold" ? "bg-blue-100 text-blue-700" : seq.relationshipTier === "warm" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{seq.relationshipTier}</span>
                <span>{seq.totalSteps} steps</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {seq.activeContacts} active</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {seq.completionRate}% completed</span>
                <span>{seq.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
