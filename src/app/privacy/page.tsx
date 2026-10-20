export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="legal-page shell">
      <p className="eyebrow">Legal</p>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Updated 12 October 2026</p>
      <h2>What we collect</h2>
      <p>We collect account details such as your email address, product access, saved questions, study activity, and basic technical logs needed to operate and secure the service. We also collect anonymous, cookieless usage and performance statistics. If you allow optional analytics cookies, we additionally measure returning visits and, when signed in, account-linked activity.</p>
      <h2>How we use it</h2>
      <p>We use this information to authenticate you, provide purchased access, save progress, support the service, prevent abuse, and improve the product.</p>
      <h2>Analytics</h2>
      <p>We measure pageviews, product use and performance anonymously, without cookies or persistent identifiers. This runs whatever your cookie choice. To see which countries visitors come from, we estimate an approximate country from your browser’s time zone; your IP address is not used for this.</p>
      <p>If you allow optional analytics cookies, we also recognise returning visits. If you are signed in and accept the current analytics choice, we link your activity to your account and share your email address with our analytics provider. Earlier analytics acceptance does not authorize email disclosure.</p>
      <p>To find and fix problems, we record redacted error reports (crashes, failed requests and images that fail to load) and keep server request logs for 14 days. When you are signed in, these include your account&apos;s random identifier, whatever your cookie choice, so we can see who a problem affected. They never include your name, email address, raw error messages or anything you type.</p>
      <p>Session replay and automatic click capture are disabled. We never send your answers or payment details to analytics. We keep an acceptance for up to 12 months and a rejection for 3 months, then ask again. If you close the banner without choosing, we ask again after 2 days.</p>
      <h2>Referral links</h2>
      <p>When you visit through a customer or partner referral link, we store a first-party referral cookie for up to 30 days. If you create a verified account, we may associate the referral with your account to track a partner commission on your first purchase or a customer invite. Inviting customers see aggregate signup progress and awarded credits, not your identity or payment details. We manually review a referred customer’s first purchase before granting any invite reward.</p>
      <h2>Service providers</h2>
      <p>We use infrastructure, analytics, and payment providers, including Supabase, Vercel, PostHog, and Stripe. They process only the information required to provide their services under their own privacy terms.</p>
      <p>The Referrals page loads Google’s “Add to Preferred Sources” button from Google, under Google’s privacy terms.</p>
      <h2>Payments</h2>
      <p>Card details are handled by Stripe and are not stored by PastPaperPrep.</p>
      <h2>Your choices</h2>
      <p>You can review or withdraw optional analytics permission using Cookie settings in the footer. Withdrawal stops future persistent and account-linked analytics and clears the optional analytics identifiers stored in your browser. Withdrawal does not stop the anonymous, cookieless baseline. It does not automatically delete previously collected events; contact us if you would like us to review a data access or deletion request.</p>
      <p>You may request access to or deletion of your account data by contacting <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>. Some records may be retained where legally required or needed to prevent fraud.</p>
    </article>
  );
}