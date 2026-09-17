export enum REPORTS_RESPONSE {
  DASHBOARD_FETCHED = 'Dashboard fetched successfully',
  REPORT_FETCHED = 'Report fetched successfully',
  SALES_SUMMARY_FETCHED = 'Sales summary fetched successfully',
  PROFIT_FETCHED = 'Profit report fetched successfully',
  TOP_PRODUCTS_FETCHED = 'Top products fetched successfully',
  TOP_CUSTOMERS_FETCHED = 'Top customers fetched successfully',
  SALES_BY_DAY_FETCHED = 'Daily sales fetched successfully',
  DEAD_STOCK_FETCHED = 'Slow-moving stock fetched successfully',
  CASH_POSITION_FETCHED = 'Cash position fetched successfully',
  UNKNOWN_REPORT = 'That report does not exist',
  PROFIT_NOT_PERMITTED = 'You do not have access to profit and margin reports',
  INVALID_PERIOD = 'A custom period needs both a start and an end date',
}
