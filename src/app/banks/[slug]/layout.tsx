import { PaymentFailedNotice } from "@/components/PaymentFailedNotice";

/** Bank pages are static; the failed-renewal notice checks the session in the browser. */
export default function BankLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><PaymentFailedNotice placement="bank" className="shell" />{children}</>;
}
