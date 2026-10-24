"use client";

import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  kicker?: string;
  onClose: () => void;
  closeLabel?: string;
  children?: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
};

export function Modal({
  open,
  title,
  kicker,
  onClose,
  closeLabel = "Close",
  children,
  actions,
  dismissible = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
      };
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function requestClose() {
    if (dismissible) onClose();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  return (
    <dialog className="modal" ref={dialogRef} aria-labelledby={titleId} onCancel={handleCancel}>
      <div className="dialog-heading">
        <div>
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="dialog-close"
          type="button"
          onClick={requestClose}
          disabled={!dismissible}
          aria-label={closeLabel}
        >
          <X size={20} />
        </button>
      </div>
      {children}
      {actions ? <div className="dialog-actions">{actions}</div> : null}
    </dialog>
  );
}
