// Compatibility entry point for existing receipt/payment screens.
import IncomeExpenseTransactions, { type IncomeExpenseTransactionsProps } from "./IncomeExpenseTransactions";

export default function CentralFinanceTransactions({ allowTypeSwitch = false, ...props }: IncomeExpenseTransactionsProps) {
  return <IncomeExpenseTransactions {...props} allowTypeSwitch={allowTypeSwitch} />;
}
