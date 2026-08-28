import { type ReactNode, type RefObject, useEffect, useRef } from "react";

type ModalProps = {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  open: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
};

export function Modal({ children, labelledBy, onClose, open, returnFocus }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      requestAnimationFrame(() => {
        const initial = dialog.querySelector<HTMLElement>("[data-initial-focus]")
          ?? dialog.querySelector<HTMLElement>("[autofocus]")
          ?? dialog.querySelector<HTMLElement>("button, [href], input, select, textarea");
        initial?.focus();
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    (returnFocus?.current ?? returnFocusRef.current)?.focus();
  }, [open, returnFocus]);

  const requestClose = () => {
    dialogRef.current?.close();
    onCloseRef.current();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-layer"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          requestClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {open && children}
    </dialog>
  );
}
