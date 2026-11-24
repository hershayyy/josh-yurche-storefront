import type { Metadata } from "next";
import { CommissionForm } from "@/components/commission-form";
import { PageShell, PageTitle } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Commissions",
  description:
    "Commission request preview for Josh Yurche. Submissions are not enabled yet.",
};

export default function CommissionsPage() {
  return (
    <PageShell narrow>
      <PageTitle>Commissions</PageTitle>
      <p className="mt-4 text-base leading-7">
        Tell Josh about a project. The form shows the details a request will
        include.
      </p>
      <CommissionForm />
    </PageShell>
  );
}
