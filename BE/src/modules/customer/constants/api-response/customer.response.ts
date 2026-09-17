export enum CUSTOMER_RESPONSE {
  CREATED = 'Customer created successfully',
  FETCHED = 'Customer fetched successfully',
  LIST_FETCHED = 'Customers fetched successfully',
  UPDATED = 'Customer updated successfully',
  DELETED = 'Customer deactivated successfully',
  NOT_FOUND = 'Customer not found',
  PHONE_TAKEN = 'Another customer already uses that phone number',

  LEDGER_FETCHED = 'Customer ledger fetched successfully',
  STATEMENT_FETCHED = 'Customer statement fetched successfully',
  BALANCE_RECALCULATED = 'Customer balance recalculated from the ledger',
  AGING_FETCHED = 'Receivables aging fetched successfully',
  OPENING_RECORDED = 'Opening balance recorded successfully',
  ADJUSTED = 'Customer balance adjusted successfully',
  WRITTEN_OFF = 'Balance written off successfully',

  LEDGER_IMMUTABLE = 'Ledger entries cannot be edited. Record a correcting adjustment instead.',
  CREDIT_LIMIT_EXCEEDED = 'This sale would put the customer over their credit limit',
  CREDIT_NOT_ALLOWED = 'This customer is cash-only',
}
