'use client';
import './loan-receipt.css';
import { formatBorrowerCode } from '@/lib/borrower-code';

type ReceiptData = {
  receiptNumber: string;
  paidAt: string;
  timeRecorded?: boolean;
  amount: number;
  interestPaid: number;
  penaltyPaid: number;
  principalPaid: number;
  method: string;
  note?: string | null;
};
type ReceiptBranch = {
  name: string;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
};

const TZ = 'Asia/Bangkok';
const baht = (value: number) => new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
}).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat('th-TH', {
  timeZone: TZ,
  dateStyle: 'medium',
}).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat('th-TH', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(value));

export default function LoanReceipt({
  receipt,
  contractNumber,
  borrowerCode,
  borrowerName,
  borrowerAddress,
  borrowerHouseNumber,
  branch,
  onClose,
}: {
  receipt: ReceiptData;
  contractNumber: string;
  borrowerCode: string;
  borrowerName: string;
  borrowerAddress?: string | null;
  borrowerHouseNumber?: string | null;
  branch?: ReceiptBranch | null;
  onClose: () => void;
}) {
  return (
    <div className="loan-receipt-shell">
      <article className="loan-receipt-ticket" aria-label="ใบรับชำระเงิน">
        <header className="loan-receipt-heading">
          <span>ใบเสร็จรับเงิน / TAX INVOICE</span>
          <h2>ใบรับชำระเงิน</h2>
          <p><strong>เลขที่ใบเสร็จ</strong> {receipt.receiptNumber}</p>
        </header>

        {branch && <section className="loan-receipt-issuer" aria-label="ข้อมูลบริษัทและสาขา">
          <strong>{branch.name || branch.companyName}</strong>
          {branch.companyName && branch.name && branch.name !== branch.companyName && <span>บริษัทแม่ {branch.companyName}</span>}
          {branch.taxId && <span>เลขทะเบียน / เลขประจำตัวผู้เสียภาษีอากร {branch.taxId}</span>}
          {branch.address && <span>{branch.address}</span>}
          {branch.phone && <span>โทร. {branch.phone}</span>}
        </section>}

        <dl className="loan-receipt-details">
          <div><dt>วันที่รับชำระ</dt><dd>{dateLabel(receipt.paidAt)}{receipt.timeRecorded !== false ? ` · ${timeLabel(receipt.paidAt)} น.` : ''}</dd></div>
          <div><dt>เลขที่สัญญา</dt><dd>{contractNumber}</dd></div>
          <div><dt>ผู้กู้</dt><dd>{borrowerName}</dd></div>
          <div><dt>บ้านเลขที่</dt><dd>{borrowerHouseNumber || 'ไม่ได้ระบุ'}</dd></div>
          <div><dt>ที่อยู่ผู้กู้</dt><dd>{borrowerAddress || 'ไม่ได้ระบุ'}</dd></div>
          <div><dt>รหัสผู้กู้</dt><dd>{formatBorrowerCode(borrowerCode)}</dd></div>
        </dl>

        <div className="loan-receipt-line-item">
          <span>รายการ</span>
          <strong>รับชำระตามสัญญา</strong>
        </div>
        <div className="loan-receipt-total">
          <span>ยอดรับชำระ</span>
          <strong>{baht(receipt.amount)}</strong>
        </div>

        <dl className="loan-receipt-allocation">
          <div><dt>ตัดดอกเบี้ย</dt><dd>{baht(receipt.interestPaid)}</dd></div>
          <div><dt>ตัดค่าปรับ</dt><dd>{baht(receipt.penaltyPaid)}</dd></div>
          <div><dt>ตัดเงินต้น</dt><dd>{baht(receipt.principalPaid)}</dd></div>
        </dl>

        <p className="loan-receipt-method">รับชำระโดย {receipt.method === 'CASH' ? 'เงินสด' : receipt.method === 'BANK_TRANSFER' ? 'โอนเงิน' : receipt.method}</p>
        {receipt.note && <p className="loan-receipt-note">หมายเหตุ: {receipt.note}</p>}
        <footer className="loan-receipt-signature">
          <span>ขอบคุณที่ชำระเงิน</span>
          <div><i />ผู้รับเงิน</div>
        </footer>
      </article>

      <div className="loan-receipt-actions">
        <button type="button" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
        <button type="button" onClick={onClose}>ปิดใบรับชำระ</button>
      </div>
    </div>
  );
}
