import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  industry: z.string().optional(),
  relationshipType: z.enum(["referral_partner", "customer", "prospect", "other"]).default("referral_partner"),
  howWeMet: z.string().optional(),
  personalNotes: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  birthday: z.string().optional(),
  loopStatus: z.enum(["active", "paused", "archived"]).default("active"),
  sendFrequencyWeeks: z.coerce.number().int().min(1).max(52).default(4),
});

type FormData = z.infer<typeof schema>;

const INDUSTRY_OPTIONS = [
  { value: "construction", label: "Construction" },
  { value: "real_estate", label: "Real Estate" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance / Insurance" },
  { value: "marketing", label: "Marketing / Sales" },
  { value: "legal", label: "Legal" },
  { value: "technology", label: "Technology" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

export default function ContactForm({ contact, onSuccess }: { contact?: any; onSuccess: () => void }) {
  const isEdit = !!contact;
  const [tags, setTags] = useState<string[]>(() => {
    if (contact?.tags) { try { return JSON.parse(contact.tags); } catch { return []; } }
    return [];
  });
  const [tagInput, setTagInput] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: contact ? {
      firstName: contact.firstName,
      lastName: contact.lastName ?? "",
      email: contact.email,
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      industry: contact.industry ?? "",
      relationshipType: contact.relationshipType,
      howWeMet: contact.howWeMet ?? "",
      personalNotes: contact.personalNotes ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      instagramUrl: contact.instagramUrl ?? "",
      facebookUrl: contact.facebookUrl ?? "",
      birthday: contact.birthday ?? "",
      loopStatus: contact.loopStatus,
      sendFrequencyWeeks: contact.sendFrequencyWeeks,
    } : { relationshipType: "referral_partner", loopStatus: "active", sendFrequencyWeeks: 4 },
  });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => { toast.success("Contact added!"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => { toast.success("Contact updated!"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data: any) => {
    if (isEdit) {
      updateMutation.mutate({ id: contact.id, ...data, tags });
    } else {
      createMutation.mutate({ ...data, tags });
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(""); }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input {...register("firstName")} placeholder="John" />
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Last Name</Label>
          <Input {...register("lastName")} placeholder="Smith" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Email *</Label>
          <Input {...register("email")} type="email" placeholder="john@company.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="(555) 000-0000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Company</Label>
          <Input {...register("company")} placeholder="Acme Construction" />
        </div>
        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Select value={watch("industry") ?? ""} onValueChange={v => setValue("industry", v)}>
            <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Relationship Type</Label>
          <Select value={watch("relationshipType")} onValueChange={v => setValue("relationshipType", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="referral_partner">Referral Partner</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Loop Status</Label>
          <Select value={watch("loopStatus")} onValueChange={v => setValue("loopStatus", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Send Frequency (weeks between touches)</Label>
        <Input {...register("sendFrequencyWeeks")} type="number" min={1} max={52} className="w-32" />
        <p className="text-xs text-muted-foreground">e.g. 4 = one email every 4 weeks</p>
      </div>
      <div className="space-y-1.5">
        <Label>How We Met</Label>
        <Input {...register("howWeMet")} placeholder="Chamber networking event, May 2024" />
      </div>
      <div className="space-y-1.5">
        <Label>Personal Notes</Label>
        <Textarea {...register("personalNotes")} placeholder="Big Cowboys fan. Kid graduating May 2025. Wife named Sarah." rows={3} />
        <p className="text-xs text-muted-foreground">This is what the AI uses to personalize emails — the more detail, the better.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Birthday (MM-DD)</Label>
        <Input {...register("birthday")} placeholder="06-15" className="w-32" />
      </div>
      {/* Social Links */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Social Links</Label>
        <div className="space-y-2">
          <Input {...register("linkedinUrl")} placeholder="LinkedIn URL" />
          <Input {...register("instagramUrl")} placeholder="Instagram URL" />
          <Input {...register("facebookUrl")} placeholder="Facebook URL" />
        </div>
      </div>
      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
          <Button type="button" variant="outline" size="sm" onClick={addTag}><Plus className="w-4 h-4" /></Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full">
                {tag}
                <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Contact"}
        </Button>
      </div>
    </form>
  );
}
