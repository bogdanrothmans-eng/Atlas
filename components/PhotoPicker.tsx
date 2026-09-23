import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const photoError = (file: File) => {
  if (!PHOTO_TYPES.includes(file.type)) return "Подойдут JPG, PNG или WebP";
  if (file.size > PHOTO_MAX_BYTES) return "Фото должно быть меньше 5 МБ";
  return null;
};

/*
 * A file field that shows what was picked. The native input stays in the form
 * (visually hidden, still focusable), so the form reads the file from
 * FormData and keyboard users reach the picker through its label.
 */
export function PhotoPicker({
  name = "photo",
  label,
  hint,
  required = false,
  alt,
}: {
  name?: string;
  label: React.ReactNode;
  hint?: string;
  required?: boolean;
  alt: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
  };

  const pick = (file: File | undefined) => {
    if (!file) {
      setPreview(null);
      return;
    }
    const problem = photoError(file);
    setError(problem);
    if (problem) {
      clear();
      return;
    }
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm leading-none font-medium">
          {label}
        </label>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="peer sr-only"
        onChange={(event) => pick(event.target.files?.[0])}
      />
      {preview ? (
        <div className="bg-muted image-outline relative aspect-video overflow-hidden rounded-lg">
          {/* A blob URL from the picked file; next/image cannot optimise it. */}
          <img src={preview} alt={alt} className="size-full object-cover" />
          <div className="absolute inset-x-2 bottom-2 flex justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-sm"
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw /> Заменить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shadow-sm"
              onClick={clear}
            >
              <X /> Убрать
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm transition-colors",
            "peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 peer-focus-visible:ring-[3px]",
            error && "border-destructive",
          )}
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          <span className="text-foreground font-medium">Выбрать фото</span>
          <span className="text-xs">JPG, PNG или WebP до 5 МБ</span>
        </label>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
