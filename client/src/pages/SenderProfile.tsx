import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Building2, User, MapPin, Briefcase, Heart, BookOpen, Users, Globe } from "lucide-react";

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
      )}
    </div>
  );
}

export default function SenderProfile() {
  const { data: profile, isLoading } = trpc.senderProfile.get.useQuery();
  const upsertMutation = trpc.senderProfile.upsert.useMutation({
    onSuccess: () => toast.success("Profile saved!"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      const fields: Record<string, string> = {};
      Object.entries(profile).forEach(([k, v]) => { if (typeof v === "string" && v) fields[k] = v; });
      setForm(fields);
    }
  }, [profile]);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="page-enter max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-foreground">Sender Profile & Voice</h1>
        <p className="text-muted-foreground text-sm mt-1">This information powers your AI-generated sequence emails. Fill in as much as you can.</p>
      </div>

      <div className="space-y-8">
        {/* Personal Info */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> About You</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={form.senderFirstName ?? ""} onChange={v => set("senderFirstName", v)} placeholder="Rob" />
            <Field label="Last Name" value={form.senderLastName ?? ""} onChange={v => set("senderLastName", v)} placeholder="Cooley" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={form.phone ?? ""} onChange={v => set("phone", v)} placeholder="(555) 123-4567" />
            <Field label="Website" value={form.website ?? ""} onChange={v => set("website", v)} placeholder="https://cooleybrothers.com" />
          </div>
          <Field label="LinkedIn URL" value={form.linkedinUrl ?? ""} onChange={v => set("linkedinUrl", v)} placeholder="https://linkedin.com/in/..." />
          <Field label="Mailing Address" value={form.mailingAddress ?? ""} onChange={v => set("mailingAddress", v)} placeholder="123 Main St, Torrance, CA 90501" />
        </section>

        {/* Business Info */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Your Business</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Name" value={form.companyName ?? ""} onChange={v => set("companyName", v)} placeholder="Cooley Brothers" />
            <Field label="Industry" value={form.industry ?? ""} onChange={v => set("industry", v)} placeholder="HVAC / Home Services" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} placeholder="Torrance" />
            <Field label="Service Area" value={form.serviceArea ?? ""} onChange={v => set("serviceArea", v)} placeholder="South Bay, Los Angeles" />
          </div>
          <Field label="Main Service" value={form.mainService ?? ""} onChange={v => set("mainService", v)} multiline placeholder="What do you do in one sentence?" />
          <Field label="Short Company Description" value={form.shortCompanyDescription ?? ""} onChange={v => set("shortCompanyDescription", v)} multiline placeholder="2-3 sentences about your company" />
          <Field label="People You Normally Help" value={form.peopleNormallyHelped ?? ""} onChange={v => set("peopleNormallyHelped", v)} multiline placeholder="Homeowners, property managers, small businesses..." />
          <Field label="Main Problem You Solve" value={form.mainProblemSolved ?? ""} onChange={v => set("mainProblemSolved", v)} multiline placeholder="What pain point do you fix?" />
          <Field label="Ideal Referral" value={form.idealReferral ?? ""} onChange={v => set("idealReferral", v)} multiline placeholder="Describe your perfect referral" />
        </section>

        {/* Values & Stories */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Heart className="w-4 h-4" /> Values & Stories</h2>
          <Field label="Business Values" value={form.businessValues ?? ""} onChange={v => set("businessValues", v)} multiline placeholder="What do you believe good business looks like? (honesty, reliability, fair pricing...)" />
          <Field label="Client Success Story" value={form.clientSuccessStory ?? ""} onChange={v => set("clientSuccessStory", v)} multiline placeholder="Brief story: problem → what you did → outcome" />
          <Field label="Personal Business Lesson" value={form.personalBusinessLesson ?? ""} onChange={v => set("personalBusinessLesson", v)} multiline placeholder="A personal lesson about business, family, or service" />
        </section>

        {/* Resources & Community */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Resources & Community</h2>
          <Field label="Helpful Tip" value={form.helpfulTip ?? ""} onChange={v => set("helpfulTip", v)} multiline placeholder="One practical tip you can share" />
          <Field label="Helpful Resource" value={form.helpfulResource ?? ""} onChange={v => set("helpfulResource", v)} multiline placeholder="A checklist, guide, article, or local resource" />
          <Field label="Community Involvement" value={form.communityInvolvement ?? ""} onChange={v => set("communityInvolvement", v)} multiline placeholder="Local events, causes, groups you participate in" />
        </section>

        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => upsertMutation.mutate(form as any)}
          disabled={upsertMutation.isPending}
        >
          <Save className="w-4 h-4" />
          {upsertMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
