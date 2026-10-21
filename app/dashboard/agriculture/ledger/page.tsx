import IncomeExpenseTransactions from '@/components/accounts/IncomeExpenseTransactions';

export default function AgricultureLedgerPage() {
  return <IncomeExpenseTransactions type="INCOME" system="AGRICULTURE" allowTypeSwitch />;
}
