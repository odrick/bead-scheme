const CARDINAL_UNITS = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
];

const CARDINAL_TEENS = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];

const CARDINAL_TENS = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
];

const CARDINAL_HUNDREDS = [
    "",
    "one hundred",
    "two hundred",
    "three hundred",
    "four hundred",
    "five hundred",
    "six hundred",
    "seven hundred",
    "eight hundred",
    "nine hundred",
];

const ORDINAL_UNITS = [
    "",
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
];

const ORDINAL_TEENS = [
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
];

const ORDINAL_TENS = {
    20: "twentieth",
    30: "thirtieth",
    40: "fortieth",
    50: "fiftieth",
    60: "sixtieth",
    70: "seventieth",
    80: "eightieth",
    90: "ninetieth",
};

export function cardinalToWords(value: number): string {
    if (!Number.isFinite(value) || value <= 0 || value >= 1000) {
        return String(value);
    }

    const parts: string[] = [];
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;

    if (hundreds > 0) {
        parts.push(CARDINAL_HUNDREDS[hundreds]);
    }

    if (remainder >= 10 && remainder < 20) {
        parts.push(CARDINAL_TEENS[remainder - 10]);
        return parts.join(" ");
    }

    const tens = Math.floor(remainder / 10);
    const units = remainder % 10;

    if (tens > 0) {
        parts.push(CARDINAL_TENS[tens]);
    }

    if (units > 0) {
        parts.push(CARDINAL_UNITS[units]);
    }

    return parts.join(" ");
}

export function ordinalToWords(value: number): string {
    if (!Number.isFinite(value) || value <= 0 || value >= 1000) {
        return String(value);
    }

    if (value < 10) {
        return ORDINAL_UNITS[value];
    }

    if (value < 20) {
        return ORDINAL_TEENS[value - 10];
    }

    if (value % 10 === 0) {
        return (
            ORDINAL_TENS[value as keyof typeof ORDINAL_TENS] ?? String(value)
        );
    }

    const units = value % 10;
    const tensWord = CARDINAL_TENS[Math.floor(value / 10)];
    const unitForm = ORDINAL_UNITS[units];

    if (!tensWord || !unitForm) {
        return String(value);
    }

    return `${tensWord}-${unitForm}`;
}

export function describeRun(count: number, paletteIndex: number): string {
    return `${cardinalToWords(count)} ${ordinalToWords(paletteIndex + 1)}.`;
}

export function describeSkipRun(count: number): string {
    return `Skip ${count}.`;
}

export function pluralizeUa(
    value: number,
    form1: string,
    form2: string,
    form5: string,
): string {
    const abs = Math.abs(value) % 100;
    const last = abs % 10;

    if (abs > 10 && abs < 20) return form5;
    if (last === 1) return form1;
    if (last >= 2 && last <= 4) return form2;
    return form5;
}
