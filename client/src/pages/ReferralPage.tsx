import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Gift, Copy, Share2, Twitter, Mail } from "lucide-react";

export default function ReferralPage() {
  const { user } = useAuth();
  const { data, isLoading } = trpc.public.getReferralCode.useQuery();

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  const referralUrl = `https://closelooper.manus.space/signup?ref=${data?.referralCode}`;

  const copyLink = () => { navigator.clipboard.writeText(referralUrl); toast.success("Referral link copied!"); };
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I've been using Close Looper to stay top of mind with my referral partners — and it's been a game changer. Check it out: ${referralUrl}`)}`);
  const shareEmail = () => window.open(`mailto:?subject=${encodeURIComponent("You should check out Close Looper")}&body=${encodeURIComponent(`Hey,\n\nI've been using this tool called Close Looper to stay in touch with my referral partners automatically. It writes personalized emails in my voice and sends them from my real Gmail. Only $30/month.\n\nCheck it out: ${referralUrl}\n\nTalk soon`)}`);

  return (
    <div className="page-enter max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif">Refer a Friend</h1>
        <p className="text-muted-foreground text-sm mt-1">Share Close Looper and earn a free month for every friend who pays their first month.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Gift className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="font-semibold">Your Referral Link</p>
            <p className="text-xs text-muted-foreground">Share this link. When someone signs up and pays their first month, you get a free month.</p>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <code className="flex-1 bg-muted/40 rounded-lg px-3 py-2 text-sm font-mono truncate">{referralUrl}</code>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0"><Copy className="w-3.5 h-3.5" /> Copy</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={shareTwitter} className="gap-1.5"><Twitter className="w-3.5 h-3.5" /> Share on X</Button>
          <Button variant="outline" size="sm" onClick={shareEmail} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Share via Email</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Free Months Earned", value: data?.freeMonthsEarned ?? 0, color: "text-green-600" },
          { label: "Total Referrals", value: data?.referrals?.length ?? 0, color: "text-blue-600" },
          { label: "Paid Referrals", value: data?.referrals?.filter((r: any) => r.status === "paid" || r.status === "credited").length ?? 0, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-3xl font-serif font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {data?.referrals && data.referrals.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-medium mb-3">Referral History</h3>
          <div className="space-y-2">
            {data.referrals.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.referredEmail ?? "Pending signup"}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "credited" ? "bg-green-100 text-green-700" : r.status === "paid" ? "bg-blue-100 text-blue-700" : r.status === "signed_up" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
