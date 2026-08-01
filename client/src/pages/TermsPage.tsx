import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <nav className="sticky top-0 z-50 bg-[#FAFAF7]/95 backdrop-blur border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><span className="text-xl font-serif font-bold">Close Looper</span></Link>
          <Link href="/"><Button variant="ghost" size="sm">← Back to Home</Button></Link>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
        <h1 className="text-4xl font-serif font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: August 1, 2026</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">By accessing or using Close Looper ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
        <p className="text-muted-foreground leading-relaxed">Close Looper is a relationship-nurturing email automation tool that helps users stay in touch with their professional network. The Service generates AI-assisted email drafts and sends them through the user's connected Gmail account.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">3. User Responsibilities</h2>
        <p className="text-muted-foreground leading-relaxed">You are responsible for all content sent through the Service. You agree not to use the Service to send spam, unsolicited commercial email, or any content that violates applicable law. You must comply with CAN-SPAM, GDPR, and all other applicable email regulations in your jurisdiction.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">4. Gmail Integration</h2>
        <p className="text-muted-foreground leading-relaxed">Close Looper connects to your Gmail account via Google OAuth. We only request permissions necessary to send emails on your behalf. We do not read, store, or share your email content beyond what is necessary to operate the Service. You can revoke access at any time through your Google account settings.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">5. Subscription and Billing</h2>
        <p className="text-muted-foreground leading-relaxed">The Service is offered at $30/month. Billing details and payment processing will be provided when payment functionality is activated. You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">6. Referral Program</h2>
        <p className="text-muted-foreground leading-relaxed">Users may earn free months by referring new paying subscribers. Free month credits are applied after the referred user completes their first paid month. Credits have no cash value and are non-transferable.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">7. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">Close Looper is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid in the 12 months preceding the claim.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">8. Termination</h2>
        <p className="text-muted-foreground leading-relaxed">We reserve the right to suspend or terminate your account for violation of these terms, abuse of the Service, or non-payment. You may terminate your account at any time by contacting us.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">We may update these terms from time to time. We will notify you of material changes via email. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">For questions about these terms, please contact us at the email address provided in your account settings.</p>
      </div>
    </div>
  );
}
