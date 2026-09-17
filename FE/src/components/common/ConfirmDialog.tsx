import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from 'src/components/common/Dialog';
import { Button } from 'src/components/common/Button';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /**
   * Both optional — genuinely uncontrolled usage (neither passed) works
   * correctly: Cancel/Escape/overlay-click all close it via Radix's own native
   * state, not a caller-supplied callback (see the Cancel button below). Pass
   * both only when the caller needs to close the dialog itself from outside —
   * e.g. after an async `onConfirm` action succeeds (see
   * DeleteExampleItemButton.tsx), since Confirm deliberately never auto-closes
   * in either mode: closing-on-success is always the caller's job, the same
   * "UI effects live in the call site's own onSuccess" rule AGENTS.md § Data &
   * State's Mutations bullet documents for every other mutation in this repo.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Destructive/blocking-action confirmation, built on the common `Dialog`. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  // Radix's own `open`/`onOpenChange` props are typed `boolean | undefined`-free
  // (plain `open?: boolean`), so passing `undefined` explicitly — which is what
  // omitting these on ConfirmDialog produces after destructuring — doesn't
  // type-check under exactOptionalPropertyTypes. Spread them in only when set,
  // which is also the behavior Radix itself expects for uncontrolled mode.
  return (
    <Dialog {...(open !== undefined ? { open, onOpenChange } : {})}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent dialogTitle={title}>
        {description ? <p className="text-foreground-muted mb-4 text-sm">{description}</p> : null}
        <div className="flex justify-end gap-2">
          {/* Radix's own close primitive, not a hand-rolled onOpenChange?.(false)
              call — DialogClose resolves against whichever mode Dialog above is
              actually in (controlled or not), so Cancel always closes the dialog
              regardless of whether the caller passed open/onOpenChange at all. */}
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {cancelLabel ?? t('BUTTON_CANCEL')}
            </Button>
          </DialogClose>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel ?? t('BUTTON_CONFIRM')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
