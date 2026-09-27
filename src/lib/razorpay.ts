// Thin wrapper around Razorpay's REST API (Basic Auth with key id/secret).
// https://razorpay.com/docs/api/payments/payment-links/

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.description || `Razorpay request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export type RazorpayPaymentLink = {
  id: string;
  short_url: string;
  amount: number;
  status: "created" | "paid" | "cancelled" | "expired" | "partially_paid";
};

export async function createPaymentLink(params: {
  amountInRupees: number;
  description: string;
  referenceId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<RazorpayPaymentLink> {
  return razorpayRequest<RazorpayPaymentLink>("/payment_links", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(params.amountInRupees * 100),
      currency: "INR",
      description: params.description,
      reference_id: params.referenceId,
      customer: {
        name: params.customerName || undefined,
        email: params.customerEmail || undefined,
        contact: params.customerPhone || undefined,
      },
      notify: { sms: false, email: false },
    }),
  });
}

export async function getPaymentLink(razorpayId: string): Promise<RazorpayPaymentLink> {
  return razorpayRequest<RazorpayPaymentLink>(`/payment_links/${razorpayId}`, { method: "GET" });
}

// https://razorpay.com/docs/api/payments/
export type RazorpayPayment = {
  id: string;
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  description: string | null;
  email: string | null;
  contact: string | null;
  notes: Record<string, string> | unknown[];
  order_id: string | null;
  created_at: number; // unix seconds
};

export async function getPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

// All payments created between two dates (any status -- callers filter to
// captured ones). Razorpay caps a page at 100, so this pages through with
// `skip` up to maxPayments.
export async function listPayments(from: Date, to: Date, maxPayments = 2000): Promise<RazorpayPayment[]> {
  const all: RazorpayPayment[] = [];
  const fromTs = Math.floor(from.getTime() / 1000);
  const toTs = Math.floor(to.getTime() / 1000);
  for (let skip = 0; skip < maxPayments; skip += 100) {
    const page = await razorpayRequest<{ items: RazorpayPayment[] }>(
      `/payments?from=${fromTs}&to=${toTs}&count=100&skip=${skip}`,
      { method: "GET" }
    );
    all.push(...page.items);
    if (page.items.length < 100) break;
  }
  return all;
}
