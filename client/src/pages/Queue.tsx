import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Pencil, Send, Inbox, ChevronDown, ChevronUp, Info } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  federal_holiday: "Federal Holiday",
  quirky_holiday: "Quirky Holiday",
  industry_specific: "Industry",
  personal_milestone: "Personal",
};

export default function Queue() {
  const { data: drafts, isLoading, refetch } = trpc.drafts.list.useQuery({ status: "pending" });
  const { data: gmailAccounts } = trpc.gmail.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [selectedGmail, setSelectedGmail] = useState<Record<number, number>>({});

  const approveMutation = trpc.drafts.approve.useMutation({
    onSuccess: () => { toast.success("Draft approved!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const skipMutation = trpc.drafts.skip.useMutation({
    onSuccess: () => { toast.success("Draft skipped"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const feedbackCaptureMutation = trpc.feedback.captureEdit.useMutation();
  const editMutation = trpc.drafts.edit.useMutation({
    onSuccess: () => { toast.success("Draft updated!"); setEditingId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const sendMutation = trpc.drafts.send.useMutation({
    onSuccess: () => { toast.success("Email sent!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const defaultGmailId = gmailAccounts?.find(a => a.isDefault)?.id ?? gmailAccounts?.[0]?.id;

  const startEdit = (draft: any) => {
    setEditingId(draft.id);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setExpandedId(draft.id);
  };

  const handleApproveAndSend = (draft: any) => {
    const gmailId = selectedGmail[draft.id] ?? defaultGmailId;
    if (!gmailId) {
      toast.error("Please connect a Gmail account in Settings first.");
      return;
    }
    approveMutation.mutate({ id: draft.id, gmailAccountId: gmailId }, {
      onSuccess: () => sendMutation.mutate({ id: draft.id }),
    });
  };

  return (
    <div className="page-enter max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Approval Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {drafts?.length ?? 0} draft{drafts?.length !== 1 ? "s" : ""} waiting for your review
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : !drafts || drafts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Queue is empty</p>
          <p className="text-sm mt-1">New drafts will appear here when the AI generates them, or you can generate one manually from a contact's profile.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map(draft => {
            const isExpanded = expandedId === draft.id;
            const isEditing = editingId === draft.id;
            const gmailId = selectedGmail[draft.id] ?? defaultGmailId;
            const contact = draft.contact;
            return (
              <div key={draft.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                    {contact?.firstName?.charAt(0)}{contact?.lastName?.charAt(0) ?? ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{contact?.firstName} {contact?.lastName}</span>
                      {draft.touchpointCategory && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${draft.touchpointCategory.replace("_", "-").replace("_", "-")}`}>
                          {CATEGORY_LABELS[draft.touchpointCategory] ?? draft.touchpointCategory}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-0.5 text-foreground">{draft.subject}</p>
                    {/* Why explanation */}
                    <div className="flex items-start gap-1.5 mt-1.5">
                      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground italic">{draft.whyExplanation}</p>
                    </div>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : draft.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-border pt-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                          <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Body</label>
                          <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6} className="text-sm leading-relaxed" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => {
                            editMutation.mutate({ id: draft.id, subject: editSubject, body: editBody }, {
                              onSuccess: () => {
                                // Capture the edit as a feedback rule
                                feedbackCaptureMutation.mutate({
                                  draftId: draft.id,
                                  originalBody: draft.body,
                                  editedBody: editBody,
                                });
                              },
                            });
                          }} disabled={editMutation.isPending}>
                            {editMutation.isPending ? "Saving..." : "Save changes"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{draft.body}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center gap-2 flex-wrap">
                  {/* Gmail selector */}
                  {gmailAccounts && gmailAccounts.length > 0 && (
                    <Select
                      value={String(gmailId ?? "")}
                      onValueChange={v => setSelectedGmail(prev => ({ ...prev, [draft.id]: parseInt(v) }))}
                    >
                      <SelectTrigger className="h-8 text-xs w-48 bg-background">
                        <SelectValue placeholder="Select Gmail account" />
                      </SelectTrigger>
                      <SelectContent>
                        {gmailAccounts.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.gmailAddress} {a.isDefault ? "(default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => startEdit(draft)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => skipMutation.mutate({ id: draft.id })} disabled={skipMutation.isPending}>
                      <XCircle className="w-3.5 h-3.5" /> Skip
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => approveMutation.mutate({ id: draft.id, gmailAccountId: gmailId })} disabled={approveMutation.isPending}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" className="h-8 gap-1.5" onClick={() => handleApproveAndSend(draft)} disabled={sendMutation.isPending || approveMutation.isPending}>
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
