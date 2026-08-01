import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  skipped: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-700",
};

export default function CalendarPage() {
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [confirmSendDraft, setConfirmSendDraft] = useState<any>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const manualSendMutation = trpc.drafts.manualSend.useMutation();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const scheduleMutation = trpc.drafts.scheduleSend.useMutation({
    onSuccess: () => { toast.success("Email scheduled!"); setSelectedDraft(null); setShowScheduleDialog(false); },
    onError: (e: any) => toast.error(e?.message || "Failed to schedule"),
  });
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const editMutation = trpc.drafts.edit.useMutation({
    onSuccess: () => { toast.success("Email updated"); setIsEditing(false); },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const startDate = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
  const endDate = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59), [currentDate]);

  const { data: calendarEvents, isLoading } = trpc.analytics.calendarEvents.useQuery({ startDate, endDate });
  const { data: allDrafts, isLoading: listLoading } = trpc.analytics.listView.useQuery();

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // Build calendar grid
  const firstDayOfMonth = startDate.getDay();
  const daysInMonth = endDate.getDate();
  const calendarDays: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const eventsByDay = useMemo(() => {
    const map: Record<number, typeof calendarEvents> = {};
    (calendarEvents ?? []).forEach(event => {
      const d = event.scheduledSendAt ? new Date(event.scheduledSendAt).getDate() : event.sentAt ? new Date(event.sentAt).getDate() : null;
      if (d) { if (!map[d]) map[d] = []; map[d]!.push(event); }
    });
    return map;
  }, [calendarEvents]);

  return (
    <div className="page-enter max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">All scheduled and sent emails</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <button onClick={() => setView("calendar")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${view === "calendar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Calendar
            </button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="font-serif text-xl">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
          </div>
          {/* Calendar grid */}
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-64 w-full rounded-lg" /></div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const events = day ? (eventsByDay[day] ?? []) : [];
                const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                return (
                  <div key={idx} className={`min-h-[90px] p-2 border-b border-r border-border ${!day ? "bg-muted/20" : ""}`}>
                    {day && (
                      <>
                        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 ${isToday ? "bg-primary text-primary-foreground font-semibold" : "text-foreground"}`}>{day}</div>
                        <div className="space-y-0.5">
              {events.slice(0, 3).map(event => (
                            <div key={event.id} className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer ${STATUS_COLORS[event.status] ?? "bg-gray-100"}`} onClick={() => setSelectedDraft(event)} title={`${event.subject}${event.scheduledSendAt ? ` — Scheduled: ${new Date(event.scheduledSendAt).toLocaleString()}` : ""}`}>
                              {event.contact?.firstName} {event.contact?.lastName?.charAt(0) ?? ""}.{event.scheduledSendAt ? " ⏰" : ""}
                            </div>
                          ))}
                          {events.length > 3 && <div className="text-xs text-muted-foreground px-1">+{events.length - 3} more</div>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">All Emails — Chronological</h2>
          </div>
          {listLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !allDrafts || allDrafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No emails yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Opens</th>
                  </tr>
                </thead>
                <tbody>
                  {allDrafts.map(draft => {
                    const date = draft.sentAt ?? draft.scheduledSendAt ?? draft.createdAt;
                    return (
                      <tr key={draft.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{date ? new Date(date).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 font-medium">{draft.contact?.firstName} {draft.contact?.lastName}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">{draft.subject}</td>
                        <td className="px-4 py-3">
                          {draft.touchpointCategory && (
                            <span className={`text-xs px-2 py-0.5 rounded-full badge-${draft.touchpointCategory}`}>
                              {draft.touchpointCategory.replace(/_/g, " ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full badge-${draft.status}`}>{draft.status}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{draft.openCount > 0 ? draft.openCount : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <Dialog open={!!selectedDraft} onOpenChange={v => !v && setSelectedDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isEditing ? (
                <input
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded text-lg font-serif bg-background"
                />
              ) : selectedDraft?.subject}
            </DialogTitle>
          </DialogHeader>
          {selectedDraft && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">To:</span>
                <span className="text-sm font-medium">{selectedDraft.contact?.firstName} {selectedDraft.contact?.lastName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full badge-${selectedDraft.status}`}>{selectedDraft.status}</span>
                {selectedDraft.status !== "sent" && !isEditing && (
                  <button
                    className="text-xs text-primary hover:underline ml-auto"
                    onClick={() => { setIsEditing(true); setEditSubject(selectedDraft.subject); setEditBody(selectedDraft.body); }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {selectedDraft.touchpointName && (
                <p className="text-sm text-muted-foreground">Touchpoint: <span className="font-medium text-foreground">{selectedDraft.touchpointName}</span></p>
              )}
              {isEditing ? (
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y leading-relaxed"
                />
              ) : (
                <div className="bg-muted/40 rounded-lg p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedDraft.body}</p>
                </div>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      editMutation.mutate({ id: selectedDraft.id, subject: editSubject, body: editBody }, {
                        onSuccess: () => {
                          setSelectedDraft({ ...selectedDraft, subject: editSubject, body: editBody });
                        }
                      });
                    }}
                    disabled={editMutation.isPending}
                  >
                    {editMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              {defaultSignature && selectedDraft.status !== "sent" && !isEditing && (
                <div className="border-t border-dashed border-border pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Signature: {defaultSignature.name}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{defaultSignature.content}</p>
                </div>
              )}
              {selectedDraft.sentAt && <p className="text-xs text-muted-foreground">Sent: {new Date(selectedDraft.sentAt).toLocaleString()}</p>}
              {selectedDraft.openCount > 0 && <p className="text-xs text-green-600">Opened {selectedDraft.openCount} time{selectedDraft.openCount !== 1 ? "s" : ""}</p>}
              {selectedDraft.status !== "sent" && (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => setConfirmSendDraft(selectedDraft)}
                    className="flex-1"
                    disabled={manualSendMutation.isPending}
                  >
                    Send Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setScheduleDate(""); setShowScheduleDialog(true); }}
                    className="flex-1"
                  >
                    Schedule
                  </Button>
                </div>
              )}
              {selectedDraft.scheduledSendAt && selectedDraft.status !== "sent" && (
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3 mt-2">
                  <p className="text-xs text-blue-700">Scheduled: {new Date(selectedDraft.scheduledSendAt).toLocaleString()}</p>
                  <button
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                    onClick={() => { scheduleMutation.mutate({ id: selectedDraft.id, scheduledSendAt: null as any }); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmSendDraft} onOpenChange={v => !v && setConfirmSendDraft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send email now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the email to {confirmSendDraft?.contact?.firstName} {confirmSendDraft?.contact?.lastName} immediately, outside your approval queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-3 rounded text-sm max-h-32 overflow-auto">
            <p className="font-mono text-xs whitespace-pre-wrap">{confirmSendDraft?.body}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await manualSendMutation.mutateAsync({ id: confirmSendDraft.id });
                  toast.success("Email sent successfully");
                  setConfirmSendDraft(null);
                  setSelectedDraft(null);
                } catch (e: any) {
                  console.error("[manualSend] Client error:", e);
                  toast.error(e?.message || "Failed to send email");
                }
              }}
              disabled={manualSendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send Email
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Send Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Schedule Send</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pick a date and time to send "{selectedDraft?.subject}".</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!scheduleDate || scheduleMutation.isPending}
              onClick={() => {
                if (selectedDraft && scheduleDate) {
                  const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
                  scheduleMutation.mutate({ id: selectedDraft.id, scheduledSendAt: scheduledAt });
                }
              }}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
  const { data: defaultSignature } = trpc.signatures.getDefault.useQuery();
