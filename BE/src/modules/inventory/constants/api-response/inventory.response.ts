export enum INVENTORY_RESPONSE {
  LEDGER_FETCHED = 'Stock movements fetched successfully',
  STOCK_FETCHED = 'Stock levels fetched successfully',
  ADJUSTED = 'Stock adjusted successfully',
  RECALCULATED = 'Stock recalculated from the movement history',
  OPENING_RECORDED = 'Opening stock recorded successfully',
  WRITTEN_OFF = 'Stock written off successfully',

  TRANSFER_CREATED = 'Stock transfer created successfully',
  TRANSFERS_FETCHED = 'Stock transfers fetched successfully',
  TRANSFER_DISPATCHED = 'Stock transfer dispatched successfully',
  TRANSFER_RECEIVED = 'Stock transfer received successfully',
  TRANSFER_CANCELLED = 'Stock transfer cancelled successfully',
  TRANSFER_NOT_FOUND = 'Stock transfer not found',
  TRANSFER_NOT_DISPATCHABLE = 'Only a draft transfer can be dispatched',
  TRANSFER_NOT_RECEIVABLE = 'Only a transfer in transit can be received',
  TRANSFER_SAME_LOCATION = 'A transfer needs two different locations',

  LOW_STOCK_FETCHED = 'Low stock items fetched successfully',
  EXPIRING_FETCHED = 'Expiring batches fetched successfully',
  VALUATION_FETCHED = 'Stock valuation fetched successfully',

  INSUFFICIENT_STOCK = 'Not enough stock to complete this operation',
  PRODUCT_NOT_FOUND = 'Product not found',
  ZERO_QUANTITY = 'A stock movement needs a non-zero quantity',
  LEDGER_IMMUTABLE = 'Stock movements cannot be edited. Record a correcting adjustment instead.',
}
