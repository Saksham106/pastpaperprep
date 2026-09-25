import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <section className="account-section-page">
      <p className="eyebrow">Account</p>
      <h1>Security</h1>
      <div className="account-setting-row">
        <div><strong>Password</strong><span>Add or change the password used to sign in.</span></div>
        <Link className="button secondary" href="/account/password">Password settings</Link>
      </div>
      <div className="account-setting-row">
        <div><strong>Sign out</strong><span>End your current session on this device.</span></div>
        <form action={signOut}><button className="button secondary" type="submit">Sign out</button></form>
      </div>
    </section>
  );
}
