/** Renders a rupee amount with the decimal portion visually de-emphasized (smaller + muted)
 *  so it doesn't get misread as part of the whole-rupee value, e.g. ₹10,500.00. */
export function Rupees({ amount, className }: { amount: number; className?: string }) {
  const [whole, decimal] = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  return (
    <span className={className}>
      ₹{whole}
      <span className="text-[0.65em] opacity-70">.{decimal}</span>
    </span>
  );
}
