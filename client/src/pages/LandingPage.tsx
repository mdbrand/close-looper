import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Calendar, Users, Zap, Star, ArrowRight, Share2, Gift } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] text-foreground font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF7]/95 backdrop-blur border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-serif font-bold tracking-tight">Close Looper</span>
          <div className="flex items-center gap-3">
            <Link href="/signin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#1a1a1a] text-white hover:bg-[#333]">Request Access</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <Badge variant="outline" className="mb-6 text-xs px-3 py-1 border-amber-300 text-amber-700 bg-amber-50">Invite Only — Limited Access</Badge>
        <h1 className="text-5xl md:text-6xl font-serif font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
          You're one email away from<br className="hidden md:block" /> your next referral.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
          Close Looper is the only tool built specifically to keep you top of mind with referral partners — automatically, personally, and consistently — every single month.
        </p>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10">
          If you drive business from referral partners, this pays for itself hand over fist. It's <strong>$30/month</strong> and it runs itself.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-[#1a1a1a] text-white hover:bg-[#333] gap-2 px-8">
              Request Early Access <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="outline" className="px-8">Already have access? Sign In</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Invite-only. No credit card required to apply.</p>
      </section>

      {/* Social Proof Strip */}
      <section className="bg-[#1a1a1a] text-white py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center gap-8 text-sm text-white/70">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Sends from your real Gmail inbox</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> AI writes in your voice</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> 7th-grade reading level, no fluff</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> Lands in Primary inbox, not Promotions</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400" /> CAN-SPAM compliant</span>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">The Problem</p>
            <h2 className="text-3xl font-serif font-bold mb-5 leading-snug">Your referral partners forget you exist between deals.</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You know you should be staying in touch. You just never do it. Life gets busy, and "I'll send them something this week" turns into six months of silence.</p>
            <p className="text-muted-foreground leading-relaxed">When they finally have a referral to send, they think of whoever they talked to most recently. That's not you.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">The Solution</p>
            <h2 className="text-3xl font-serif font-bold mb-5 leading-snug">Close Looper keeps you top of mind — without you lifting a finger.</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Every month, Close Looper generates a personalized, casual email for each of your referral partners — tied to a holiday, a quirky national day, or something specific to their industry.</p>
            <p className="text-muted-foreground leading-relaxed">You review it in 30 seconds, hit send, and it goes from your real Gmail account. It looks like you wrote it yourself. Because the AI learned your voice.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F5F4EF] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">How It Works</p>
            <h2 className="text-4xl font-serif font-bold">Everything you need. Nothing you don't.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Users className="w-6 h-6" />, title: "Contact Database", desc: "Add your referral partners with full profiles — industry, notes, social links, how you met. The more context you give, the more personal the emails." },
              { icon: <Zap className="w-6 h-6" />, title: "AI Hybrid Email Copy", desc: "AI tailors the copy to fit your specific voice and tone — casual, no fluff, 7th-grade reading level. Tied to a real moment: a holiday, an industry milestone, or something personal to them." },
              { icon: <Mail className="w-6 h-6" />, title: "Approval Queue", desc: "Every draft lands in your queue first. Review, edit, or skip in seconds. You're always in control of what goes out." },
              { icon: <Calendar className="w-6 h-6" />, title: "Calendar View", desc: "See every email scheduled, sent, and opened on a clean calendar. Click any email to view, edit, or send it immediately." },
              { icon: <Star className="w-6 h-6" />, title: "Open Tracking", desc: "Know exactly who opened your emails and when. The dashboard shows your open rate, active contacts, and who needs attention." },
              { icon: <Share2 className="w-6 h-6" />, title: "Cold Relationship Sequence", desc: "A 12-step, 12-month sequence that turns a cold contact into a warm referral partner — without ever being pushy or fake." },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-border/40 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-[#1a1a1a]/5 flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pricing</p>
        <h2 className="text-4xl font-serif font-bold mb-4">Simple, flat pricing.</h2>
        <p className="text-muted-foreground mb-12 max-w-xl mx-auto">No tiers. No per-seat fees. No usage limits. One price, full access to everything.</p>
        <div className="max-w-sm mx-auto bg-[#1a1a1a] text-white rounded-3xl p-8 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-amber-400 text-amber-900 border-0 text-xs px-3">Most Popular</Badge>
          </div>
          <p className="text-5xl font-serif font-bold mb-1">$30</p>
          <p className="text-white/60 text-sm mb-6">per month · cancel anytime</p>
          <ul className="text-sm text-white/80 space-y-2 mb-8 text-left">
            {["Unlimited contacts", "AI email generation", "Multi-Gmail account support", "Approval queue", "Calendar & list views", "Open tracking", "Cold Relationship Sequence", "Business card scanner", "Bulk import/export", "Weekly digest email"].map(f => (
              <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />{f}</li>
            ))}
          </ul>
          <Button disabled className="w-full bg-white/20 text-white cursor-not-allowed opacity-70">Coming Soon</Button>
          <p className="text-xs text-white/40 mt-3">Payments launching soon. Apply for early access now.</p>
        </div>
      </section>

      {/* Referral Program */}
      <section className="bg-[#F5F4EF] py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Gift className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Referral Program</p>
          <h2 className="text-4xl font-serif font-bold mb-4">Share it. Get a free month.</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            Every Close Looper member gets a unique referral link. Share it with anyone who drives business from referral partners. When they sign up and pay their first month, you get a full month free — automatically credited to your account.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-sm">
            {[["1", "Share your link", "Send it to anyone who could benefit from staying top of mind with referral partners."], ["2", "They sign up & pay", "Your friend joins Close Looper and completes their first month."], ["3", "You get a free month", "A free month is automatically credited to your account. No codes, no hassle."]].map(([n, t, d]) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-border/40 text-left">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] text-white text-xs font-bold flex items-center justify-center mb-3">{n}</div>
                <p className="font-semibold mb-1">{t}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">Free month credit is applied after the referred user completes their first paid month. No limit on referrals.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-serif font-bold mb-4">Ready to stop losing referrals to silence?</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-8">Close Looper is invite-only right now. Apply for early access and be first in line when we open the doors.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-[#1a1a1a] text-white hover:bg-[#333] gap-2 px-10">
            Apply for Early Access <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-serif font-bold text-foreground">Close Looper</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/signin" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <span>© 2026 Close Looper. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
