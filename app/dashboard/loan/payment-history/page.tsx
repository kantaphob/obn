import { redirect } from "next/navigation";

export default function PaymentHistoryPage() {
  redirect("/dashboard/loan/payments");
}
