import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Pencil, Trash2, PauseCircle, PlayCircle, Archive, Zap, User, Building2, Tag, Download, Upload } from "lucide-react";
import { useLocation } from "wouter";
import ContactForm from "@/components/ContactForm";
import { Textarea } from "@/components/ui/textarea";

const INDUSTRY_OPTIONS = [
  "construction", "real_estate", "healthcare", "finance", "marketing",
  "legal", "technology", "education", "other"
];

const LOOP_STATUS_LABELS: Record<string, string> = {
  active: "Active", paused: "Paused", archived: "Archived"
};

const REL_TYPE_LABELS: Record<string, string> = {
  referral_partner: "Referral Partner", customer: "Customer",
  prospect: "Prospect", other: "Other"
};

export default function Contacts() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importPreview, setImportPreview] = useState<any>(null);

  const { data: contacts, isLoading, refetch } = trpc.contacts.list.useQuery();
  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => { toast.success("Contact deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const setStatusMutation = trpc.contacts.setLoopStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (contacts ?? []).filter(c => {
    const name = `${c.firstName} ${c.lastName ?? ""}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || c.email.includes(search.toLowerCase()) || (c.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.loopStatus === filterStatus;
    const matchIndustry = filterIndustry === "all" || c.industry === filterIndustry;
    return matchSearch && matchStatus && matchIndustry;
  });

  return (
    <div className="page-enter max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contacts?.length ?? 0} people in your network
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, company..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterIndustry} onValueChange={setFilterIndustry}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All industries" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contact List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No contacts yet</p>
          <p className="text-sm mt-1">Add your first referral partner to get started.</p>
          <Button onClick={() => setShowAddDialog(true)} className="mt-4 gap-2" variant="outline">
            <Plus className="w-4 h-4" /> Add Contact
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(contact => {
            const tags: string[] = contact.tags ? JSON.parse(contact.tags) : [];
            return (
              <div key={contact.id} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer group" onClick={() => setLocation(`/contacts/${contact.id}`)}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                  {contact.firstName.charAt(0)}{contact.lastName?.charAt(0) ?? ""}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{contact.firstName} {contact.lastName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${contact.loopStatus}`}>{LOOP_STATUS_LABELS[contact.loopStatus]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{REL_TYPE_LABELS[contact.relationshipType]}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                    {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contact.company}</span>}
                    {contact.industry && <span className="capitalize">{contact.industry.replace("_", " ")}</span>}
                    <span>{contact.email}</span>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {tags.slice(0, 4).map(tag => <span key={tag} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{tag}</span>)}
                    </div>
                  )}
                </div>
                {/* Frequency */}
                <div className="text-xs text-muted-foreground text-right shrink-0 hidden sm:block">
                  <div className="flex items-center gap-1"><Zap className="w-3 h-3" />Every {contact.sendFrequencyWeeks}w</div>
                  {contact.lastTouchSentAt && <div className="mt-0.5">Last: {new Date(contact.lastTouchSentAt).toLocaleDateString()}</div>}
                </div>
                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <button className="p-2 rounded-lg hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditContact(contact); }}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    {contact.loopStatus === "active" ? (
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setStatusMutation.mutate({ id: contact.id, status: "paused" }); }}>
                        <PauseCircle className="w-4 h-4 mr-2" /> Pause Loop
                      </DropdownMenuItem>
                    ) : contact.loopStatus === "paused" ? (
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setStatusMutation.mutate({ id: contact.id, status: "active" }); }}>
                        <PlayCircle className="w-4 h-4 mr-2" /> Resume Loop
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); setStatusMutation.mutate({ id: contact.id, status: "archived" }); }}>
                      <Archive className="w-4 h-4 mr-2" /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={e => { e.stopPropagation(); if (confirm("Delete this contact?")) deleteMutation.mutate({ id: contact.id }); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Add Contact</DialogTitle></DialogHeader>
          <ContactForm onSuccess={() => { setShowAddDialog(false); refetch(); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={v => !v && setEditContact(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Edit Contact</DialogTitle></DialogHeader>
          {editContact && <ContactForm contact={editContact} onSuccess={() => { setEditContact(null); refetch(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
