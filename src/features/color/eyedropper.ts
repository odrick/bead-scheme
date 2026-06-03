/** Чи доступний системний піпетник (Chrome, Edge, Opera). */
export function isEyedropperSupported(): boolean {
    return typeof window !== "undefined" && "EyeDropper" in window;
}

/** Повертає #rrggbb або null, якщо скасовано / недоступно. */
export async function pickScreenColor(): Promise<string | null> {
    if (!isEyedropperSupported()) return null;

    try {
        const dropper = new EyeDropper();
        const { sRGBHex } = await dropper.open();

        return sRGBHex;
    } catch {
        return null;
    }
}
