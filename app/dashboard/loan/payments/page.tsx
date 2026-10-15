"use client";

import { useState } from "react";
import PaymentHistory from "@/components/loan/PaymentHistory";
import PaymentEntry from "@/components/loan/PaymentEntry";

export default function PaymentsPage() {
  const [entry, setEntry] = useState<{ borrowerCode: string; contractId?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  return <>
    <PaymentHistory revision={revision} onReceivePayment={(borrowerCode, contractId) => setEntry({ borrowerCode, contractId })} />
    {entry && <PaymentEntry initialBorrowerCode={entry.borrowerCode} initialContractId={entry.contractId} onClose={() => setEntry(null)} onSaved={() => setRevision(value => value + 1)} />}
  </>;
}
