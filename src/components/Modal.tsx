"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

// Lets a submit button deep inside the modal close it once its action finishes.
const CloseContext = createContext<() => void>(() => {});

export default function Modal({
  triggerLabel,
  title,
  triggerClassName = "btn-primary",
  children,
}: {
  triggerLabel: React.ReactNode;
  title: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-6"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="card my-2 w-full max-w-3xl p-5 sm:my-8"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <CloseContext.Provider value={close}>
              {children}
            </CloseContext.Provider>
          </div>
        </div>
      )}
    </>
  );
}

// Submit button for a form rendered inside a <Modal>. Closes the modal once the
// server action completes (the surrounding page revalidates on its own).
export function ModalSubmit({
  children = "Save",
  className = "btn-primary",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const close = useContext(CloseContext);
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) close();
    wasPending.current = pending;
  }, [pending, close]);

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
