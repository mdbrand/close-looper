import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function VoiceSetup() {
  const [, setLocation] = useLocation();
  const [voiceSample, setVoiceSample] = useState("");
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState<"write" | "preview" | "done">("write");

  const { data: existing } = trpc.voice.get.useQuery();

  const previewMutation = trpc.voice.previewEmail.useMutation({
    onSuccess: (data) => { setPreview(data.preview); setStep("preview"); },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = trpc.voice.save.useMutation({
    onSuccess: () => { toast.success("Voice profile saved!"); setStep("done"); },
    onError: (e) => toast.error(e.message),
  });

  if (step === "done") {
    return (
      <div className="page-enter max-w-xl mx-auto text-center py-16">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-serif mb-2">Voice profile saved!</h1>
        <p className="text-muted-foreground mb-6">Every email the AI writes will now sound like you. You can update this anytime in Settings.</p>
        <Button onClick={() => setLocation("/contacts")} className="gap-2">Go to Contacts <ArrowRight className="w-4 h-4" /></Button>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">One-Time Setup</span>
        </div>
        <h1 className="text-3xl font-serif text-foreground">AI Voice Customization</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Write a few sentences the way you naturally talk or text. The AI will study your style and write every email to sound exactly like you — not like a robot.
        </p>
      </div>

      {existing && (
        <div className="bg-accent/50 border border-border rounded-xl p-4 mb-6">
          <p className="text-sm font-medium mb-1">Current voice profile</p>
          <p className="text-sm text-muted-foreground line-clamp-3">{existing.voiceSample}</p>
          <p className="text-xs text-muted-foreground mt-2">Updating this will replace your current profile.</p>
        </div>
      )}

      {step === "write" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Write like you talk</label>
            <Textarea
              value={voiceSample}
              onChange={e => setVoiceSample(e.target.value)}
              placeholder={`Example: "Hey man, just wanted to check in — saw you guys just wrapped that big project downtown, that's awesome. Hope the family's doing well. Let me know if you ever want to grab lunch, I'm always down. Talk soon."`}
              rows={6}
              className="resize-none text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">Write at least 3-4 sentences. The more natural the better — typos and all.</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Tips for a great voice sample:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Write like you'd text a friend, not write a business email</li>
              <li>Include your natural sign-offs ("talk soon", "catch you later", etc.)</li>
              <li>Use your actual vocabulary — slang, abbreviations, whatever you say</li>
              <li>Mention something real — a project, a person, a place</li>
            </ul>
          </div>
          <Button
            onClick={() => previewMutation.mutate({ voiceSample })}
            disabled={voiceSample.length < 20 || previewMutation.isPending}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {previewMutation.isPending ? "Generating preview..." : "Preview how the AI will write"}
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">AI-generated preview email</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{preview}</p>
          </div>
          <p className="text-sm text-muted-foreground">Does this sound like you? If yes, save it. If not, go back and tweak your sample.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("write")}>Go back and edit</Button>
            <Button onClick={() => saveMutation.mutate({ voiceSample })} disabled={saveMutation.isPending} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {saveMutation.isPending ? "Saving..." : "Yes, save this voice"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
