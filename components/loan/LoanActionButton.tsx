import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  action: "edit" | "delete";
  busy?: boolean;
};

/** Shared edit/delete actions; confirmation and data changes belong to the caller. */
export default function LoanActionButton({ action, busy = false, children, disabled, ...props }: Props) {
  const Icon = busy ? LoaderCircle : action === "edit" ? Pencil : Trash2;
  return <button {...props} type={props.type ?? "button"} data-loan-action={action} disabled={disabled || busy} aria-busy={busy || undefined}>
    <Icon size={16} aria-hidden="true" className={busy ? "animate-spin motion-reduce:animate-none" : undefined} />
    <span>{busy ? (action === "delete" ? "กำลังลบ…" : "กำลังบันทึก…") : children ?? (action === "edit" ? "แก้ไข" : "ลบ")}</span>
  </button>;
}
