import type { Metadata } from "next";
import { PaymentFailedNotice } from "@/components/PaymentFailedNotice";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><PaymentFailedNotice placement="dashboard" className="shell" />{children}</>;
}
