import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function FeedbackRules() {
  const { data: rules, isLoading, refetch } = trpc.feedback.list.useQuery();
  const createMutation = trpc.feedback.create.useMutation();
  const updateMutation = trpc.feedback.update.useMutation();
  const deleteMutation = trpc.feedback.delete.useMutation();
  
  const [newPattern, setNewPattern] = useState("");
  const [newReplacement, setNewReplacement] = useState("");
  const [newConfidence, setNewConfidence] = useState(65);

  const handleCreate = async () => {
    if (!newPattern.trim() || !newReplacement.trim()) {
      toast.error("Pattern and replacement are required");
      return;
    }
    try {
      await createMutation.mutateAsync({
        ruleType: "phrase_replacement",
        pattern: newPattern,
        replacement: newReplacement,
        confidence: newConfidence,
      });
      setNewPattern("");
      setNewReplacement("");
      setNewConfidence(65);
      toast.success("Rule created");
      refetch();
    } catch (e) {
      toast.error("Failed to create rule");
    }
  };

  const handleToggle = async (ruleId: number, isActive: boolean) => {
    try {
      await updateMutation.mutateAsync({ ruleId, isActive: !isActive });
      toast.success(isActive ? "Rule disabled" : "Rule enabled");
      refetch();
    } catch (e) {
      toast.error("Failed to update rule");
    }
  };

  const handleDelete = async (ruleId: number) => {
    try {
      await deleteMutation.mutateAsync({ ruleId });
      toast.success("Rule deleted");
      refetch();
    } catch (e) {
      toast.error("Failed to delete rule");
    }
  };

  return (
    <div className="page-enter max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-foreground">Feedback Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">AI learns from your edits and applies corrections automatically</p>
      </div>

      <Card className="p-6 mb-8 bg-blue-50 border-blue-200">
        <h2 className="font-semibold mb-4">Create New Rule</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Pattern to replace</label>
            <Input
              placeholder="e.g., just thinking of you"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Replace with</label>
            <Input
              placeholder="e.g., hi"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confidence: {newConfidence}%</label>
            <Slider
              value={[newConfidence]}
              onValueChange={(v) => setNewConfidence(v[0]!)}
              min={0}
              max={100}
              step={5}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Higher confidence = applied more often</p>
          </div>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" /> Create Rule
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Active Rules ({rules?.filter(r => r.isActive).length ?? 0})</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !rules || rules.length === 0 ? (
          <p className="text-muted-foreground">No rules yet. Create one above.</p>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="p-4 flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                  "{rule.pattern}" → "{rule.replacement}"
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Confidence: {rule.confidence}%</span>
                  <span>Applied {rule.appliedCount} times</span>
                  <span>{rule.isActive ? "✓ Active" : "○ Disabled"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => handleToggle(rule.id, rule.isActive)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
