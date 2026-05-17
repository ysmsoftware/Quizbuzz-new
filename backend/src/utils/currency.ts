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

export function convertMinorUnitToMajor(amount: number, currency: string): number {
    const divisor = CURRENCY_MINOR_UNIT_DIVISOR[currency?.toUpperCase()] ?? 100;
    return amount / divisor;
}

export function paisaToRupees(paisa: number): number {
    return convertMinorUnitToMajor(paisa, "INR");
}
