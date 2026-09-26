// Is this an online store / product sales page rather than a service
// business? The two sell differently: a store needs a buy button, visible
// price and payment options; a local business needs calls, WhatsApp and
// enquiry forms. Kept dependency-free so both the analyzer and the content
// extractor can use it.

export const PAYMENT_RE = /\b(upi|gpay|google pay|phonepe|paytm|razorpay|rupay|visa|mastercard|stripe|paypal|cashfree|instamojo|cod|cash on delivery)\b/i;
export const BUY_RE = /\b(buy( now)?|add to (cart|bag)|checkout|order now|shop now|get (instant )?access|enrol+( now)?|claim|unlock|grab (it|yours|the deal)|purchase|subscribe now|pre-?order)\b/i;
export const PRICE_RE = /(₹|rs\.?|inr|\$|€|£)\s?\d[\d,]*(\.\d+)?/i;

export function isStorePage(html: string, text: string): boolean {
  const priced = PRICE_RE.test(text);
  const buy = BUY_RE.test(text);
  const payments = PAYMENT_RE.test(html);
  const cart = /\b(shopify|woocommerce|add-to-cart|cart\.js|data-product-id|product-form)\b/i.test(html);
  return (priced && (buy || payments)) || cart;
}
