/// <reference types="vite/client" />

interface EyeDropperOpenOptions {
    signal?: AbortSignal;
}

interface EyeDropperOpenResult {
    sRGBHex: string;
}

declare class EyeDropper {
    constructor();
    open(options?: EyeDropperOpenOptions): Promise<EyeDropperOpenResult>;
}

interface Window {
    EyeDropper?: typeof EyeDropper;
}
