export type BalanceContract = {
    principal: number;
    interestRate: number;
    interestAmount: number;
    interestMode: string;
    interestRateBasis: string;
    startDate: Date;
    dueDate: Date | null;
    lateFeePerDay: number;
    lateFeeWaived: boolean;
    status: string;
    payments: {
        type: string;
        amount: number;
        paidAt: Date;
    }[];
};
export function thaiDay(value: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
    const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
    return Date.UTC(part('year'), part('month') - 1, part('day'));
}
function anniversary(start: number, offset: number) {
    const d = new Date(start), m = d.getUTCMonth() + offset;
    const last = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
    return Date.UTC(d.getUTCFullYear(), m, Math.min(d.getUTCDate(), last));
}
export function loanBalance(contract: BalanceContract, asOf: Date) {
    const day = thaiDay(asOf), start = thaiDay(contract.startDate), due = contract.dueDate ? thaiDay(contract.dueDate) : null;
    const payments = contract.payments.filter(p => thaiDay(p.paidAt) <= day);
    const totalPaid = (type: string) => payments.filter(p => p.type === type).reduce((sum, p) => sum + p.amount, 0);
    const principal = Math.max(0, contract.principal - totalPaid('PRINCIPAL'));
    let chargedInterest = 0;
    if (day >= start && contract.interestMode !== 'UPFRONT') {
        if (contract.interestRateBasis === 'MONTHLY_FLAT') {
            const monthly = Math.round(contract.principal * contract.interestRate / 100);
            for (let offset = 0; offset < 1200; offset++) {
                const chargeDay = anniversary(start, offset);
                if (chargeDay > day || (due !== null && chargeDay >= due))
                    break;
                const principalRepaid = payments.filter(p => p.type === 'PRINCIPAL' && thaiDay(p.paidAt) < chargeDay).reduce((sum, p) => sum + p.amount, 0);
                if (principalRepaid >= contract.principal)
                    break;
                chargedInterest += monthly;
            }
        }
        else
            chargedInterest = contract.interestAmount;
    }
    // Interest is kept separate from principal. Overdue charges start the day after maturity.
    const overdueDays = due === null || contract.lateFeeWaived ? 0 : Math.max(0, Math.floor((day - due) / 86400000));
    const interest = Math.max(0, chargedInterest - totalPaid('INTEREST'));
    const penalty = Math.max(0, overdueDays * contract.lateFeePerDay - totalPaid('PENALTY'));
    const balance = { principal, interest, penalty, total: principal + interest + penalty, chargedInterest, overdueDays };
    if (contract.status === 'CLOSED')
        return { ...balance, principal: 0, interest: 0, penalty: 0, total: 0 };
    if (!Object.values(balance).every(Number.isSafeInteger) || balance.total > 2147483647)
        throw new Error('ยอดค้างเกินขอบเขตที่รองรับ');
    return balance;
}
export function allocateRepayment(balance: ReturnType<typeof loanBalance>, amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > balance.total)
        throw new Error('ยอดรับชำระต้องมากกว่า 0 และไม่เกินยอดคงเหลือ');
    const interestPaid = Math.min(amount, balance.interest);
    const penaltyPaid = Math.min(amount - interestPaid, balance.penalty);
    const principalPaid = amount - interestPaid - penaltyPaid;
    return { interestPaid, penaltyPaid, principalPaid,
        principalBefore: balance.principal, interestBefore: balance.interest, penaltyBefore: balance.penalty,
        principalRemaining: balance.principal - principalPaid, interestRemaining: balance.interest - interestPaid, penaltyRemaining: balance.penalty - penaltyPaid, totalRemaining: balance.total - amount };
}
