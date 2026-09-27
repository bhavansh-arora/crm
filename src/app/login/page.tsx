import { Suspense } from "react";
import { headers } from "next/headers";
import { isInvoicesHost } from "@/lib/invoices-host";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const invoicesSite = isInvoicesHost((await headers()).get("host"));
  return (
    <Suspense>
      <LoginForm invoicesSite={invoicesSite} />
    </Suspense>
  );
}
