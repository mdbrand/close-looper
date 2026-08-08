import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", companyName: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const submit = trpc.public.submitContactInquiry.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: error => toast.error(error.message || "We could not send your message. Please try again."),
  });
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <nav className="sticky top-0 z-50 bg-[#FAFAF7]/95 backdrop-blur border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><span className="text-xl font-serif font-bold">Close Looper</span></Link>
          <Link href="/"><Button variant="ghost" size="sm">← Back to Home</Button></Link>
        </div>
      </nav>
      <main className="max-w-xl mx-auto px-6 py-16">
        {submitted ? (
          <div className="bg-white border border-border/40 rounded-2xl p-10 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h1 className="text-3xl font-serif font-bold mb-3">Message received.</h1>
            <p className="text-muted-foreground mb-6">Thanks for reaching out. We’ll get back to you as soon as we can.</p>
            <Link href="/"><Button variant="outline">Back to home</Button></Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#1a1a1a]/5 flex items-center justify-center mx-auto mb-4"><Mail className="w-6 h-6" /></div>
              <h1 className="text-4xl font-serif font-bold mb-3">Contact Close Looper</h1>
              <p className="text-muted-foreground">Questions about the beta, invoicing, or whether Close Looper fits your business? Send a note.</p>
            </div>
            <form className="bg-white border border-border/40 rounded-2xl p-8 shadow-sm space-y-5" onSubmit={event => {
              event.preventDefault();
              submit.mutate(form);
            }}>
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label><Input id="name" value={form.name} onChange={event => set("name", event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={form.email} onChange={event => set("email", event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" value={form.companyName} onChange={event => set("companyName", event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="subject">What can we help with? *</Label><Input id="subject" value={form.subject} onChange={event => set("subject", event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="message">Message *</Label><textarea id="message" value={form.message} onChange={event => set("message", event.target.value)} required minLength={10} rows={6} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" /></div>
              <Button type="submit" className="w-full bg-[#1a1a1a] text-white hover:bg-[#333]" disabled={submit.isPending}>{submit.isPending ? "Sending…" : "Send message"}</Button>
              <p className="text-xs text-center text-muted-foreground">By submitting, you agree that we may use these details to reply to your inquiry.</p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
