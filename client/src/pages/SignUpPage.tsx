import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const INDUSTRIES = ["Construction", "Real Estate", "Finance & Insurance", "Healthcare", "Legal", "Home Services", "Mortgage", "Accounting", "Marketing & Advertising", "Technology", "Retail", "Hospitality", "Other"];
const SUCCESS_METRICS = [
  "More referrals coming in from partners",
  "Partners reaching out to me first",
  "Stronger, more consistent relationships",
  "Partners mentioning my emails when we talk",
  "Measurable increase in referred revenue",
  "Staying top of mind without extra effort",
];

export default function SignUpPage() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const referredByCode = params.get("ref") ?? "";

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", companyName: "", website: "", industry: "", successMetric: "", inviteCode: "" });

  const submitMutation = trpc.public.submitSignup.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast.error(e.message ?? "Something went wrong. Please try again."),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-3">You're on the list.</h1>
          <p className="text-muted-foreground mb-6">We'll review your application and send you an invite code when a spot opens up. Keep an eye on your inbox.</p>
          <Link href="/"><Button variant="outline">Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Link href="/"><span className="text-2xl font-serif font-bold">Close Looper</span></Link>
          <h1 className="text-3xl font-serif font-bold mt-4 mb-2">Request Early Access</h1>
          <p className="text-muted-foreground text-sm">Close Looper is invite-only. Fill out the form below and we'll reach out when a spot opens up.</p>
        </div>
        <div className="bg-white border border-border/40 rounded-2xl p-8 shadow-sm space-y-5">
          {referredByCode && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              You were referred by a Close Looper member. Referral code <code className="font-mono font-semibold">{referredByCode}</code> has been applied.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Rob" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Cooley" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address *</Label>
            <Input id="email" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="rob@yourcompany.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 555-5555" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Cooley Brothers Painting" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://yourcompany.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select value={form.industry} onValueChange={v => set("industry", v)}>
              <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
              <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>How will you know this tool is working for you? *</Label>
            <Select value={form.successMetric} onValueChange={v => set("successMetric", v)}>
              <SelectTrigger><SelectValue placeholder="Choose what success looks like" /></SelectTrigger>
              <SelectContent>{SUCCESS_METRICS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inviteCode">Invite Code <span className="text-muted-foreground text-xs">(optional — skip if you don't have one)</span></Label>
            <Input id="inviteCode" value={form.inviteCode} onChange={e => set("inviteCode", e.target.value.toUpperCase())} placeholder="XXXX-XXXX" />
          </div>
          <Button
            className="w-full bg-[#1a1a1a] text-white hover:bg-[#333]"
            disabled={!form.firstName || !form.email || !form.successMetric || submitMutation.isPending}
            onClick={() => submitMutation.mutate({ ...form, referredByCode: referredByCode || undefined })}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Application"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">Already have access? <Link href="/signin" className="underline">Sign in here</Link></p>
        </div>
      </div>
    </div>
  );
}
