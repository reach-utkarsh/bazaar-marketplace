/** All amounts are integer minor units (paise). */
export function commissionFor(subtotal: number, rateBps: number): number {
  return Math.round((subtotal * rateBps) / 10_000);
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
