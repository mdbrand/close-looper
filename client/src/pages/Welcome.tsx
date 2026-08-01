import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowRight, Building2, CheckCircle2, Mail, Mic, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ONBOARDING_SKIPPED_KEY, type OnboardingStepId } from "@/lib/onboarding";

/**
 * Four-step setup: connect Gmail, describe the business, capture the user's
 * voice, add contacts. Each step asks for the minimum the product needs to
 * start working — the fuller Sender Profile and Contacts pages stay available
 * for everything else, so this stays a three-minute flow rather than a form.
 *
 * Progress is read from the server (derived from real data), never from local
 * state, so a step completed elsewhere shows as done here and reloading mid-way
 * never loses position.
 */

const STEPS: { id: OnboardingStepId; title: string; blurb: string; icon: typeof Mail }[] = [
  { id: "gmail", title: "Connect your email", blurb: "Emails send from your real Gmail, so they land in the primary inbox and look like you typed them.", icon: Mail },
  { id: "senderProfile", title: "Tell us about your business", blurb: "The AI needs to know what you do before it can write as you.", icon: Building2 },
  { id: "voice", title: "Add your voice", blurb: "A few sentences in your own words. This is what stops the emails sounding like a robot.", icon: Mic },
  { id: "contacts", title: "Add your first contacts", blurb: "The people you want to stay top of mind with.", icon: Users },
];

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { data: status, refetch, isLoading } = trpc.onboarding.status.useQuery();
  const [activeId, setActiveId] = useState<OnboardingStepId | null>(null);

  // Land on the first thing that still needs doing.
  const firstIncomplete = useMemo(
    () => (status ? STEPS.find(s => !status.steps[s.id])?.id ?? null : null),
    [status]
  );
  useEffect(() => {
    if (activeId === null && firstIncomplete) setActiveId(firstIncomplete);
  }, [firstIncomplete, activeId]);

  const skipSetup = () => {
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
    setLocation("/dashboard");
  };

  if (isLoading || !status) {
    return <div className="page-enter max-w-2xl mx-auto py-16 text-center text-muted-foreground">Loading…</div>;
  }

  if (status.isComplete) {
    return (
      <div className="page-enter max-w-xl mx-auto text-center py-16">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-serif mb-2">You're all set.</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Close Looper will draft your first emails and put them in your queue. Nothing sends until you approve it.
        </p>
        <Button onClick={() => setLocation("/dashboard")} className="gap-2">
          Go to your dashboard <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-2xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-foreground">Let's get you set up</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Four quick steps, about three minutes. You can stop any time and pick this back up from your dashboard.
        </p>
        <div className="flex items-center gap-3 mt-5">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(status.completedCount / status.totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {status.completedCount} of {status.totalSteps}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const done = status.steps[step.id];
          const open = activeId === step.id && !done;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`border rounded-xl transition-colors ${open ? "border-primary/40 bg-card" : "border-border bg-card/50"}`}
            >
              <button
                type="button"
                onClick={() => setActiveId(open ? null : step.id)}
                className="w-full flex items-center gap-4 p-4 text-left"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    done ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                  }`}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                    {index + 1}. {step.title}
                  </p>
                  {!done && <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{step.blurb}</p>}
                </div>
                {done && <span className="text-xs text-muted-foreground shrink-0">Done</span>}
              </button>

              {open && (
                <div className="px-4 pb-4 pl-[4.25rem]">
                  {step.id === "gmail" && <GmailStep />}
                  {step.id === "senderProfile" && <BusinessStep onDone={refetch} />}
                  {step.id === "voice" && <VoiceStep onDone={refetch} />}
                  {step.id === "contacts" && <ContactsStep onDone={refetch} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button onClick={skipSetup} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
          Skip for now
        </button>
        <p className="text-xs text-muted-foreground">You can finish this any time from your dashboard.</p>
      </div>
    </div>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function GmailStep() {
  const { data, isFetching } = trpc.gmail.getAuthUrl.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-3">
      <Button
        disabled={!data?.url || isFetching}
        onClick={() => { if (data?.url) window.location.href = data.url; }}
        className="gap-2"
      >
        <Mail className="w-4 h-4" /> Connect Gmail
      </Button>
      <p className="text-xs text-muted-foreground">
        Close Looper only ever sends mail you've approved. You can disconnect any time in Settings.
      </p>
    </div>
  );
}

function BusinessStep({ onDone }: { onDone: () => void }) {
  const { data: existing } = trpc.senderProfile.get.useQuery();
  const [companyName, setCompanyName] = useState("");
  const [mainService, setMainService] = useState("");
  const [city, setCity] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");

  useEffect(() => {
    if (!existing) return;
    setCompanyName(existing.companyName ?? "");
    setMainService(existing.mainService ?? "");
    setCity(existing.city ?? "");
    setMailingAddress(existing.mailingAddress ?? "");
  }, [existing]);

  const save = trpc.senderProfile.upsert.useMutation({
    onSuccess: () => { toast.success("Business details saved"); onDone(); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Input placeholder="Business name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
      <Input placeholder="What you do — e.g. commercial painting" value={mainService} onChange={e => setMainService(e.target.value)} />
      <Input placeholder="City you serve" value={city} onChange={e => setCity(e.target.value)} />
      <Input placeholder="Mailing address (required on every email by law)" value={mailingAddress} onChange={e => setMailingAddress(e.target.value)} />
      <Button
        onClick={() => save.mutate({ companyName, mainService, city, mailingAddress })}
        disabled={!companyName.trim() || !mainService.trim() || save.isPending}
      >
        {save.isPending ? "Saving…" : "Save and continue"}
      </Button>
      <p className="text-xs text-muted-foreground">
        There's more you can add later on the Sender Profile page — the more it knows, the better the emails.
      </p>
    </div>
  );
}

function VoiceStep({ onDone }: { onDone: () => void }) {
  const [voiceSample, setVoiceSample] = useState("");
  const save = trpc.voice.save.useMutation({
    onSuccess: () => { toast.success("Voice saved"); onDone(); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Textarea
        rows={5}
        value={voiceSample}
        onChange={e => setVoiceSample(e.target.value)}
        placeholder={`Write like you'd text a friend. For example: "Hey man, saw you wrapped that job downtown — looked great. Hope the family's good. Let me know if you ever want to grab lunch, always down. Talk soon."`}
        className="resize-none text-sm leading-relaxed"
      />
      <Button onClick={() => save.mutate({ voiceSample })} disabled={voiceSample.trim().length < 20 || save.isPending}>
        {save.isPending ? "Saving…" : "Save and continue"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Typos and slang are good — they're what make it sound like you.
      </p>
    </div>
  );
}

function ContactsStep({ onDone }: { onDone: () => void }) {
  const [, setLocation] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact added");
      setFirstName("");
      setEmail("");
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
        <Input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => create.mutate({ firstName, email, relationshipType: "referral_partner", relationshipTier: "warm", loopType: "flexible_touchpoints" })}
          disabled={!firstName.trim() || !email.trim() || create.isPending}
        >
          {create.isPending ? "Adding…" : "Add contact"}
        </Button>
        <Button variant="outline" onClick={() => setLocation("/contacts")}>
          Import a CSV instead
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Add one to get going — you can bulk import the rest from the Contacts page.
      </p>
    </div>
  );
}
