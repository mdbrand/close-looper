import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Linkedin, Instagram, Facebook, Mail, Phone, Building2, Calendar, Zap, Tag, PauseCircle, PlayCircle, Sparkles, Clock, MoreVertical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ContactForm from "@/components/ContactForm";

const TOUCHPOINT_CATEGORIES = ["federal_holiday", "quirky_holiday", "industry_specific", "personal_milestone"];

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedTouchpointId, setSelectedTouchpointId] = useState<number | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const contactId = parseInt(id ?? "0");
  const { data: contact, isLoading, refetch } = trpc.contacts.get.useQuery({ id: contactId }, { enabled: !!contactId });
  const { data: upcoming } = trpc.touchpoints.upcoming.useQuery({ contactId }, { enabled: !!contactId });
  const { data: drafts } = trpc.drafts.list.useQuery({ status: undefined });

  const contactDrafts = (drafts ?? []).filter(d => d.contactId === contactId);

  const setStatusMutation = trpc.contacts.setLoopStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.drafts.generate.useMutation({
    onSuccess: () => { toast.success("Draft generated and added to queue!"); setShowGenerateDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const manualSendMutation = trpc.drafts.manualSend.useMutation({
    onSuccess: () => { toast.success("Email sent!"); setSelectedEmail(null); setShowSendConfirm(false); },
    onError: (e) => toast.error(e.message),
  });

  const { data: snoozeStatus } = trpc.snooze.getSnoozeStatus.useQuery({ contactId }, { enabled: !!contactId });
  const snoozeMutation = trpc.snooze.snoozeContact.useMutation({
    onSuccess: () => { toast.success("Contact snoozed!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const unsnoozeMutation = trpc.snooze.unsnoozeContact.useMutation({
    onSuccess: () => { toast.success("Snooze removed!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  if (!contact) return <div className="text-center py-20 text-muted-foreground">Contact not found.</div>;

  const tags: string[] = contact.tags ? JSON.parse(contact.tags) : [];

  return (
    <div className="page-enter max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <button onClick={() => setLocation("/contacts")} className="p-2 rounded-lg hover:bg-accent transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-serif">{contact.firstName} {contact.lastName}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium status-${contact.loopStatus}`}>
              {contact.loopStatus.charAt(0).toUpperCase() + contact.loopStatus.slice(1)}
            </span>
          </div>
          {contact.company && <p className="text-muted-foreground mt-1">{contact.company} {contact.industry && `· ${contact.industry.replace("_", " ")}`}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => setShowGenerateDialog(true)} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Generate Email
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {snoozeStatus?.isSnoozed ? (
                <DropdownMenuItem onClick={() => unsnoozeMutation.mutate({ contactId })} disabled={unsnoozeMutation.isPending}>
                  <Clock className="w-4 h-4 mr-2" /> Unsnooze ({snoozeStatus.daysRemaining}d left)
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => snoozeMutation.mutate({ contactId, durationDays: "7" })} disabled={snoozeMutation.isPending}>
                    <Clock className="w-4 h-4 mr-2" /> Snooze 1 week
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => snoozeMutation.mutate({ contactId, durationDays: "14" })} disabled={snoozeMutation.isPending}>
                    <Clock className="w-4 h-4 mr-2" /> Snooze 2 weeks
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => snoozeMutation.mutate({ contactId, durationDays: "30" })} disabled={snoozeMutation.isPending}>
                    <Clock className="w-4 h-4 mr-2" /> Snooze 1 month
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Contact Info */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact Info</h3>
          {contact.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" />{contact.email}</div>}
          {contact.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" />{contact.phone}</div>}
          {contact.birthday && <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />Birthday: {contact.birthday}</div>}
          <div className="flex items-center gap-2 text-sm"><Zap className="w-4 h-4 text-muted-foreground" />Every {contact.sendFrequencyWeeks} weeks</div>
          {snoozeStatus?.isSnoozed && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <Clock className="w-4 h-4" /> Snoozed until {new Date(snoozeStatus.snoozeUntil!).toLocaleDateString()}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            {contact.linkedinUrl && <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Linkedin className="w-4 h-4" /></a>}
            {contact.instagramUrl && <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Instagram className="w-4 h-4" /></a>}
            {contact.facebookUrl && <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Facebook className="w-4 h-4" /></a>}
          </div>
        </div>

        {/* Loop Control */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Loop Control</h3>
          <div className="flex gap-2">
            {contact.loopStatus !== "active" && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatusMutation.mutate({ id: contact.id, status: "active" })}>
                <PlayCircle className="w-3.5 h-3.5" /> Activate
              </Button>
            )}
            {contact.loopStatus === "active" && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatusMutation.mutate({ id: contact.id, status: "paused" })}>
                <PauseCircle className="w-3.5 h-3.5" /> Pause Loop
              </Button>
            )}
          </div>
          {contact.lastTouchSentAt && <p className="text-sm text-muted-foreground">Last touch: {new Date(contact.lastTouchSentAt).toLocaleDateString()}</p>}
          {contact.nextTouchScheduledAt && <p className="text-sm text-muted-foreground">Next scheduled: {new Date(contact.nextTouchScheduledAt).toLocaleDateString()}</p>}
        </div>

        {/* Personal Notes */}
        {(contact.personalNotes || contact.howWeMet) && (
          <div className="bg-card border border-border rounded-xl p-5 md:col-span-2 space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
            {contact.howWeMet && <div><p className="text-xs text-muted-foreground mb-1">How we met</p><p className="text-sm">{contact.howWeMet}</p></div>}
            {contact.personalNotes && <div><p className="text-xs text-muted-foreground mb-1">Personal notes</p><p className="text-sm leading-relaxed">{contact.personalNotes}</p></div>}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => <span key={tag} className="text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full">{tag}</span>)}
            </div>
          </div>
        )}

        {/* Upcoming Touchpoints */}
        {upcoming && upcoming.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Upcoming Touchpoints (next 60 days)</h3>
            <div className="space-y-2">
              {upcoming.map(({ touchpoint, date }) => (
                <div key={touchpoint.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{touchpoint.name}</p>
                    <p className="text-xs text-muted-foreground">{touchpoint.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{date.toLocaleDateString()}</p>
                    <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 mt-1" onClick={() => { setSelectedTouchpointId(touchpoint.id); setShowGenerateDialog(true); }}>
                      <Sparkles className="w-3 h-3" /> Generate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email History */}
        {contactDrafts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">Email History</h3>
            <div className="space-y-2">
              {contactDrafts.slice(0, 5).map(draft => (
                <div key={draft.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors" onClick={() => setSelectedEmail(draft)}>
                  <div>
                    <p className="text-sm font-medium">{draft.subject}</p>
                    <p className="text-xs text-muted-foreground">{draft.touchpointName} · {draft.touchpointCategory}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full badge-${draft.status}`}>{draft.status}</span>
                    {draft.sentAt && <p className="text-xs text-muted-foreground mt-0.5">{new Date(draft.sentAt).toLocaleDateString()}</p>}
                    {draft.status === "sent" && <p className="text-xs text-muted-foreground">{draft.openCount} opens</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Edit Contact</DialogTitle></DialogHeader>
          <ContactForm contact={contact} onSuccess={() => { setShowEdit(false); refetch(); }} />
        </DialogContent>
      </Dialog>

      {/* Generate Email Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif text-xl">Generate Email Draft</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">The AI will write a casual, personalized email for {contact.firstName} based on their profile and the selected touchpoint.</p>
            <Button
              className="w-full gap-2"
              onClick={() => generateMutation.mutate({ contactId: contact.id, touchpointId: selectedTouchpointId ?? undefined })}
              disabled={generateMutation.isPending}
            >
              <Sparkles className="w-4 h-4" />
              {generateMutation.isPending ? "Writing email..." : "Generate Draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={v => { if (!v) setSelectedEmail(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{selectedEmail?.subject}</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full badge-${selectedEmail.status}`}>{selectedEmail.status}</span>
                <span>·</span>
                <span>{selectedEmail.touchpointName}</span>
                {selectedEmail.sentAt && <><span>·</span><span>Sent {new Date(selectedEmail.sentAt).toLocaleDateString()}</span></>}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {selectedEmail.body}
              </div>
              {selectedEmail.whyExplanation && (
                <p className="text-xs text-muted-foreground italic">Why: {selectedEmail.whyExplanation}</p>
              )}
              {(selectedEmail.status === "pending" || selectedEmail.status === "approved") && (
                <Button
                  className="w-full gap-2"
                  onClick={() => setShowSendConfirm(true)}
                  disabled={manualSendMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                  {manualSendMutation.isPending ? "Sending..." : "Send Now"}
                </Button>
              )}
              {selectedEmail.status === "sent" && (
                <div className="text-xs text-muted-foreground text-center">
                  {selectedEmail.openCount > 0 ? `Opened ${selectedEmail.openCount} time${selectedEmail.openCount > 1 ? "s" : ""}` : "Not opened yet"}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Confirmation */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this email now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send "{selectedEmail?.subject}" to {contact.firstName} immediately from your connected Gmail account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (selectedEmail) manualSendMutation.mutate({ id: selectedEmail.id }); }}>
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
