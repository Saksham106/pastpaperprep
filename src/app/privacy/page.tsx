export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="legal-page shell">
      <p className="eyebrow">Legal</p>
      <h1>Privacy policy</h1>
      <p className="legal-updated">Updated 7 October 2026</p>
      <h2>What we collect</h2>
      <p>We collect account details such as your email address, product access, saved questions, study activity, and basic technical logs needed to operate and secure the service. We also collect anonymous, cookieless usage and performance statistics. If you allow optional analytics cookies, we additionally measure returning visits and, when signed in, account-linked activity.</p>
      <h2>How we use it</h2>
      <p>We use this information to authenticate you, provide purchased access, save progress, support the service, prevent abuse, and improve the product.</p>
      <h2>Analytics</h2>
      <p>Our anonymous, cookieless baseline uses PostHog for pageviews and product-use statistics and Vercel for traffic and performance measurements. It runs whether you accept, reject or close the cookie banner. This baseline does not store analytics cookies or persistent browser identifiers. The baseline is not linked to your account. PostHog derives a rotating daily anonymous identifier from request details to estimate visits; Vercel also uses a short-lived request hash rather than analytics cookies.</p>
      <p>We enable the additional persistent PostHog analytics only after you allow optional analytics cookies. This additional layer uses cookies and browser storage to recognise returning visits. If you are signed in and have given renewed consent to this disclosure, we link usage and confirmed conversion events to your stable account identifier and send the email address on your Supabase account to PostHog so opted-in accounts are recognisable in analytics and we can understand signup, subscription and product-use journeys. Earlier analytics acceptance does not authorize email disclosure; you must accept the updated analytics choice. Guests who allow analytics are measured using a browser identifier rather than an account profile. The anonymous baseline remains separate and is not retrospectively linked to your account.</p>
      <p>We collect performance measurements and bounded browser error categories to identify slow pages and broken flows. We also send anonymous, redacted browser and server exception reports to PostHog, including exception categories, limited generated-code stack frames and build revisions, to diagnose failures. These exception reports are not linked to your account and exclude raw error messages and submitted form contents. Session replay and automatic click capture are disabled. We never send your name to PostHog. Outside this opted-in account-recognition use, we do not send submitted answers, raw error messages, or payment details to PostHog. The anonymous baseline never includes your account identifier or email address. We strip URL query strings and fragments before sending browser events.</p>
      <p>Your cookie choice applies to the additional persistent analytics, not to the anonymous baseline or essential sign-in, security, access or billing functions. Signing up, continuing to browse, or closing the banner does not grant permission for persistent or account-linked analytics. We store your preference in an essential first-party cookie for up to 180 days and, when signed in, record the analytics preference on your account so server-side conversion measurement can respect it.</p>
      <h2>Referral links</h2>
      <p>When you visit through a customer or partner referral link, we store a first-party referral cookie for up to 30 days. If you create a verified account, we may associate the referral with your account to track a partner commission on your first purchase or a customer invite. Inviting customers see aggregate signup progress and awarded credits, not your identity or payment details. We manually review a referred customer’s first purchase before granting any invite reward.</p>
      <h2>Service providers</h2>
      <p>We use infrastructure, analytics, and payment providers, including Supabase, Vercel, PostHog, and Stripe. They process only the information required to provide their services under their own privacy terms.</p>
      <h2>Payments</h2>
      <p>Card details are handled by Stripe and are not stored by PastPaperPrep.</p>
      <h2>Your choices</h2>
      <p>You can review or withdraw optional analytics permission using Cookie settings in the footer. Withdrawal stops future persistent and account-linked analytics and clears the optional analytics identifiers stored in your browser. Withdrawal does not stop the anonymous, cookieless baseline. It does not automatically delete previously collected events; contact us if you would like us to review a data access or deletion request.</p>
      <p>You may request access to or deletion of your account data by contacting <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>. Some records may be retained where legally required or needed to prevent fraud.</p>
    </article>
  );
}