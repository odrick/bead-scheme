export function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () =>
            reject(new Error("Не вдалося завантажити зображення маски."));
        img.src = src;
    });
}

export function loadImageElementFromFile(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);

    return loadImageElement(url).finally(() => {
        URL.revokeObjectURL(url);
    });
}
