export type SchemeMode = "editing" | "weaving";

export function isWeavingMode(mode: SchemeMode): boolean {
    return mode === "weaving";
}
