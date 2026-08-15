const CURRENCY_MINOR_UNIT_DIVISOR: Record<string, number> = {
    INR: 100,
    USD: 100,
    EUR: 100,
    GBP: 100,
    AUD: 100,
    CAD: 100,
    SGD: 100,
    NZD: 100,
    CHF: 100,
    JPY: 1,
    KRW: 1,
    VND: 1,
    // add currencies with special minor unit rules as needed
};

/** Rounds to 2dp — paisa/divisor is already exact at that precision (paisa is the smallest
 *  unit), this just clears binary float noise (e.g. 100.30000000000001) before it round-trips
 *  through any future arithmetic. */
export function convertMinorUnitToMajor(amount: number, currency: string): number {
    const divisor = CURRENCY_MINOR_UNIT_DIVISOR[currency?.toUpperCase()] ?? 100;
    return Math.round((amount / divisor) * 100) / 100;
}

/** Inverse of convertMinorUnitToMajor — rounds to the nearest whole minor unit, since paisa
 *  (or any minor unit) can't be fractional. */
export function convertMajorUnitToMinor(amount: number, currency: string): number {
    const divisor = CURRENCY_MINOR_UNIT_DIVISOR[currency?.toUpperCase()] ?? 100;
    return Math.round(amount * divisor);
}

export function paisaToRupees(paisa: number): number {
    return convertMinorUnitToMajor(paisa, "INR");
}

export function rupeesToPaisa(rupees: number): number {
    return convertMajorUnitToMinor(rupees, "INR");
}
