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
import { Plus, Search, MoreVertical, Pencil, Trash2, PauseCircle, PlayCircle, Archive, Zap, User, Building2, Tag, Download, Upload, Camera, Loader2, CheckCircle2 } from "lucide-react";
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanPreview, setScanPreview] = useState<any>(null);
  const [scanImageUrl, setScanImageUrl] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [showScanAnother, setShowScanAnother] = useState(false);

  const scanMutation = trpc.scan.extractContactFromImage.useMutation({
    onSuccess: (data: any) => { setScanPreview(data.data); },
    onError: (e: any) => toast.error(e.message || "Could not read image. Try a clearer photo."),
  });
  const createFromScanMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact added!");
      setScanCount(c => c + 1);
      setScanPreview(null);
      setScanImageUrl("");
      setShowScanAnother(true);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleScanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setScanImageUrl(dataUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      const mimeType = file.type || "image/jpeg";
      scanMutation.mutate({ imageBase64: base64, mimeType });
    };
    reader.readAsDataURL(file);
  };

  const { data: contacts, isLoading, refetch } = trpc.contacts.list.useQuery();
  const { data: importHistory, refetch: refetchHistory } = trpc.importExport.getImportHistory.useQuery();
  const importMutation = trpc.importExport.importContacts.useMutation({
    onSuccess: (data: any) => { toast.success(`Imported ${data.imported} contacts${data.skipped ? `, ${data.skipped} duplicates skipped` : ""}`); setShowImportModal(false); setCsvContent(""); setImportPreview(null); refetch(); refetchHistory(); },
    onError: (e) => toast.error(e.message),
  });
  const parseMutation = trpc.importExport.parseImportCSV.useMutation();
  const undoImportMutation = trpc.importExport.undoImport.useMutation({
    onSuccess: (data) => { toast.success(`Removed ${data.deleted} contacts`); refetch(); refetchHistory(); },
    onError: (e) => toast.error(e.message),
  });
  const utils = trpc.useUtils();

  const handleExport = async () => {
    try {
      const data = await utils.importExport.exportContacts.fetch();
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Contacts exported");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      parseMutation.mutate({ csvContent: text }, {
        onSuccess: (parsed) => {
          setImportPreview({
            headers: parsed.columnMapping.map((m: any) => m.mapped),
            columnMapping: parsed.columnMapping,
            rows: parsed.preview,
            allRows: parsed.allRows,
            totalRows: parsed.count,
            filename: file.name,
          });
        },
        onError: () => toast.error("Failed to parse CSV"),
      });
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importPreview?.allRows) return;
    importMutation.mutate({ rows: importPreview.allRows, skipDuplicates: true, filename: importPreview.filename || "import.csv" });
  };

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
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowScanModal(true)} variant="outline" className="gap-2">
            <Camera className="w-4 h-4" /> Scan Card
          </Button>
          <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Contact
          </Button>
        </div>
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
      {/* Import CSV Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Import Contacts from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a CSV file. We auto-detect columns like "firstname", "fname", "First Name", etc.</p>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drop your CSV file here or click to browse</p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="block mx-auto text-sm" />
            </div>
            {parseMutation.isPending && <p className="text-sm text-muted-foreground text-center">Analyzing columns...</p>}
            {importPreview && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{importPreview.totalRows} contacts found in "{importPreview.filename}"</p>
                {importPreview.columnMapping && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Column Mapping (auto-detected)</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {importPreview.columnMapping.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-muted-foreground truncate">{m.original}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-foreground">{m.mapped}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50">{importPreview.headers?.slice(0, 5).map((h: string) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr></thead>
                    <tbody>{importPreview.rows.map((row: any, i: number) => <tr key={i} className="border-t border-border">{importPreview.headers?.slice(0, 5).map((h: string) => <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h]}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowImportModal(false); setCsvContent(""); setImportPreview(null); }}>Cancel</Button>
                  <Button onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending ? "Importing..." : `Import ${importPreview.totalRows} Contacts`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Import History */}
      {importHistory && importHistory.length > 0 && (
        <div className="mt-8 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Import History</h3>
          <div className="space-y-2">
            {importHistory.map((batch: any) => (
              <div key={batch.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{batch.filename || "import.csv"}</p>
                  <p className="text-xs text-muted-foreground">{batch.contactCount} contacts • {new Date(batch.createdAt).toLocaleDateString()}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { if (confirm(`Undo this import? This will delete ${batch.contactCount} contacts.`)) undoImportMutation.mutate({ batchId: batch.id }); }}
                  disabled={undoImportMutation.isPending}
                >
                  Undo Import
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Business Card Scan Modal */}
    <Dialog open={showScanModal} onOpenChange={v => { setShowScanModal(v); if (!v) { setScanPreview(null); setScanImageUrl(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Scan Business Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a photo of a business card, flyer, or any image with contact info. AI will extract the details automatically.</p>
            {!scanPreview && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Camera className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">Take a photo or upload an image</p>
                <input type="file" accept="image/*" capture="environment" onChange={handleScanUpload} className="block mx-auto text-sm" />
              </div>
            )}
            {scanMutation.isPending && (
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Reading contact info from image...</p>
              </div>
            )}
            {scanImageUrl && !scanMutation.isPending && (
              <img src={scanImageUrl} alt="Scanned" className="w-full max-h-40 object-contain rounded-lg border border-border" />
            )}
            {scanPreview && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm font-medium">Contact info extracted — review and confirm</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "First Name", key: "firstName" },
                    { label: "Last Name", key: "lastName" },
                    { label: "Email", key: "email" },
                    { label: "Phone", key: "phone" },
                    { label: "Company", key: "company" },
                    { label: "Industry", key: "industry" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <input
                        className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
                        value={scanPreview[key] ?? ""}
                        onChange={e => setScanPreview((p: any) => ({ ...p, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                {scanPreview.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <textarea className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" rows={2} value={scanPreview.notes} onChange={e => setScanPreview((p: any) => ({ ...p, notes: e.target.value }))} />
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setScanPreview(null); setScanImageUrl(""); }}>Re-scan</Button>
                  <Button
                    onClick={() => createFromScanMutation.mutate({
                      firstName: scanPreview.firstName || "Unknown",
                      lastName: scanPreview.lastName || "",
                      email: scanPreview.email || "",
                      phone: scanPreview.phone || "",
                      company: scanPreview.company || "",
                      industry: scanPreview.industry || "",
                      linkedinUrl: scanPreview.linkedinUrl || "",
                      personalNotes: scanPreview.notes || "",
                      relationshipType: "referral_partner",
                      loopStatus: "active",
                      sendFrequencyWeeks: 4,
                    })}
                    disabled={createFromScanMutation.isPending}
                  >
                    {createFromScanMutation.isPending ? "Adding..." : "Add Contact"}
                  </Button>
                </div>
              </div>
            )}
            {/* Scan Another success state */}
            {showScanAnother && !scanPreview && !scanMutation.isPending && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{scanCount} contact{scanCount !== 1 ? "s" : ""} added this session</p>
                  <p className="text-sm text-muted-foreground mt-1">Ready to scan another card?</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => { setShowScanModal(false); setScanCount(0); setShowScanAnother(false); }}>Done</Button>
                  <Button onClick={() => { setShowScanAnother(false); setScanImageUrl(""); }} className="gap-2">
                    <Camera className="w-4 h-4" /> Scan Another Card
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile FAB for quick scan */}
      <button
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-primary/90 transition-colors"
        onClick={() => { setShowScanAnother(false); setShowScanModal(true); }}
        aria-label="Scan business card"
      >
        <Camera className="w-6 h-6" />
      </button>
    </div>
  );
}