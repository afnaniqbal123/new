export enum SALES_RESPONSE {
  CREATED = 'Sale completed successfully',
  QUOTED = 'Basket priced successfully',
  FETCHED = 'Sale fetched successfully',
  LIST_FETCHED = 'Sales fetched successfully',
  PAYMENT_RECORDED = 'Payment recorded successfully',
  VOIDED = 'Sale voided successfully',
  NOT_FOUND = 'Sale not found',
  NOT_COMPLETED = 'Only a completed sale can be changed this way',

  NO_LINES = 'A sale needs at least one line',
  PRODUCT_NOT_FOUND = 'One of the products on this sale no longer exists',
  OVERPAID = 'The payment is more than the sale total',
  INVALID_PAYMENT_AMOUNT = 'That payment amount is not valid for this sale',
  CREDIT_NEEDS_CUSTOMER = 'A sale with an unpaid balance needs a customer',
  BELOW_MINIMUM_PRICE = 'One or more lines are priced below the product minimum',

  RETURN_CREATED = 'Return recorded successfully',
  RETURNS_FETCHED = 'Returns fetched successfully',
  RETURN_NOT_FOUND = 'Return not found',
  RETURN_EXCEEDS_SALE = 'You cannot return more than was sold',
  RETURN_ON_VOID_SALE = 'This sale was voided; there is nothing to return',

  SUMMARY_FETCHED = 'Sales summary fetched successfully',
}
