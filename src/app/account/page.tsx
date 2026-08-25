import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { PortalButton } from "@/components/BillingActions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your account" };

type Entitlement = {
  status: string;
  expires_at: string | null;
  products: { name: string } | { name: string }[] | null;
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account");
  }

  const [{ data: userData }, { data: entitlementData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("entitlements")
      .select("status, expires_at, products(name)")
      .eq("user_id", claimsData.claims.sub)
      .in("status", ["active", "trialing"]),
  ]);

  const entitlements = (entitlementData ?? []) as Entitlement[];

  return (
    <section className="account-page shell">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Welcome back.</h1>
          <p>{userData.user?.email}</p>
        </div>
        <form action={signOut}>
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </div>

      <article className="account-card">
        <span className="eyebrow">Access</span>
        {entitlements.length ? (
          <div className="account-access-active">
            <ul className="access-list">
              {entitlements.map((entitlement, index) => {
                const product = Array.isArray(entitlement.products)
                  ? entitlement.products[0]
                  : entitlement.products;
                return (
                  <li key={`${product?.name ?? "access"}-${index}`}>
                    <strong>{product?.name ?? "Question bank access"}</strong>
                    <span>{entitlement.status}</span>
                  </li>
                );
              })}
            </ul>
            <PortalButton />
          </div>
        ) : (
          <div className="empty-access">
            <h2>No paid access yet</h2>
            <p>Your account is ready. Paid plans will appear here once checkout launches.</p>
            <Link className="button primary" href="/pricing">View planned access</Link>
          </div>
        )}
      </article>
    </section>
  );
}