"use client";
// TEMPORARY review page — not committed. Same shared pieces and classes as the real check-email screens.
import { CheckEmailHeader, EmailCodeForm, OrganizationEmailNotice } from "@/components/CheckEmailHelp";

export function Screen({ title, eyebrow, email, what, school, waited }: { title: string; eyebrow: string; email: string; what: string; school: boolean; waited: boolean }) {
  return (
    <div className="auth-card auth-card-compact">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <section className="check-email">
        <CheckEmailHeader id={`h-${email}`} headingRef={null} email={email} what={what} />
        {school && <OrganizationEmailNotice onUsePersonal={() => {}} />}
        <EmailCodeForm email={email} type="signup" next="/pricing" />
        <div className="check-email-footer">
          <span>{waited && !school ? "Nothing yet? Check spam." : "Didn’t get it?"}</span>
          <div className="check-email-actions">
            <button className="text-button" type="button" disabled={!waited}>{waited ? "Resend email" : "Resend in 42s"}</button>
            <button className="text-button" type="button">Change email</button>
          </div>
        </div>
      </section>
    </div>
  );
}
