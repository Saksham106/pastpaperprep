export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="legal-page shell">
      <p className="eyebrow">Legal</p>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Effective 25 August 2026</p>
      <h2>What we collect</h2>
      <p>We collect account details such as your email address, product access, saved questions, study activity, and basic technical logs needed to operate and secure the service.</p>
      <h2>How we use it</h2>
      <p>We use this information to authenticate you, provide purchased access, save progress, support the service, prevent abuse, and improve the product.</p>
      <h2>Service providers</h2>
      <p>We use infrastructure and payment providers, including Supabase, Vercel, and Stripe. They process only the information required to provide their services under their own privacy terms.</p>
      <h2>Payments</h2>
      <p>Card details are handled by Stripe and are not stored by PastPaperPrep.</p>
      <h2>Your choices</h2>
      <p>You may request access to or deletion of your account data by contacting support@pastpaperprep.com. Some records may be retained where legally required or needed to prevent fraud.</p>
    </article>
  );
}