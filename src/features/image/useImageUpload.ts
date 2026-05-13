import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type DragEventHandler,
} from "react";

type DropEvent = React.DragEvent<HTMLElement>;

export function useImageUpload() {
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [bitmap, setBitmap] = useState<HTMLImageElement | null>(null);
    const [isUploadDragOver, setIsUploadDragOver] = useState(false);
    const [isOriginalDragOver, setIsOriginalDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFile = useCallback((file: File | null) => {
        if (!file || !file.type.startsWith("image/")) return;

        const url = URL.createObjectURL(file);
        setFileUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }

            return url;
        });
    }, []);

    const onDropFile = useCallback(
        (event: DropEvent) => {
            event.preventDefault();
            setIsUploadDragOver(false);
            setIsOriginalDragOver(false);
            onFile(event.dataTransfer.files?.[0] ?? null);
        },
        [onFile],
    );

    const onUploadDragOver: DragEventHandler<HTMLElement> = useCallback(
        (event) => {
            event.preventDefault();
            setIsUploadDragOver(true);
        },
        [],
    );

    const onUploadDragLeave: DragEventHandler<HTMLElement> = useCallback(
        (event) => {
            event.preventDefault();
            setIsUploadDragOver(false);
        },
        [],
    );

    const onOriginalDragOver: DragEventHandler<HTMLElement> = useCallback(
        (event) => {
            event.preventDefault();
            setIsOriginalDragOver(true);
        },
        [],
    );

    const onOriginalDragLeave: DragEventHandler<HTMLElement> = useCallback(
        (event) => {
            event.preventDefault();
            setIsOriginalDragOver(false);
        },
        [],
    );

    useEffect(() => {
        if (!fileUrl) {
            setBitmap(null);

            return;
        }

        const img = new Image();
        img.decoding = "async";
        img.onload = () => setBitmap(img);
        img.src = fileUrl;

        return () => {
            img.onload = null;
        };
    }, [fileUrl]);

    useEffect(() => {
        return () => {
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
        };
    }, [fileUrl]);

    return {
        bitmap,
        fileInputRef,
        isUploadDragOver,
        isOriginalDragOver,
        onFile,
        onDropFile,
        onUploadDragOver,
        onUploadDragLeave,
        onOriginalDragOver,
        onOriginalDragLeave,
    };
}
