export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="legal-page shell">
      <p className="eyebrow">Legal</p>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Updated 24 September 2026</p>
      <h2>What we collect</h2>
      <p>We collect account details such as your email address, product access, saved questions, study activity, and basic technical logs needed to operate and secure the service. We also collect cookieless usage events through PostHog to understand how people use the product.</p>
      <h2>How we use it</h2>
      <p>We use this information to authenticate you, provide purchased access, save progress, support the service, prevent abuse, and improve the product.</p>
      <h2>Analytics</h2>
      <p>PostHog provides anonymous, cookieless product analytics so we can understand which product features are useful. Session replay and automatic click capture are disabled, and we do not send account identifiers, submitted answers, or payment details to PostHog.</p>
      <h2>Referral links</h2>
      <p>When you visit through a partner link, we store a first-party referral cookie for up to 30 days. If you sign up, we may associate the referral with your account to track a partner commission on your first purchase.</p>
      <h2>Service providers</h2>
      <p>We use infrastructure, analytics, and payment providers, including Supabase, Vercel, PostHog, and Stripe. They process only the information required to provide their services under their own privacy terms.</p>
      <h2>Payments</h2>
      <p>Card details are handled by Stripe and are not stored by PastPaperPrep.</p>
      <h2>Your choices</h2>
      <p>You may request access to or deletion of your account data by contacting <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>. Some records may be retained where legally required or needed to prevent fraud.</p>
    </article>
  );
}