export enum CATALOG_RESPONSE {
  PRODUCT_CREATED = 'Product created successfully',
  PRODUCTS_FETCHED = 'Products fetched successfully',
  PRODUCT_FETCHED = 'Product fetched successfully',
  PRODUCT_UPDATED = 'Product updated successfully',
  PRODUCT_DELETED = 'Product archived successfully',
  PRODUCT_NOT_FOUND = 'Product not found',
  SKU_TAKEN = 'Another product already uses that SKU',
  BARCODE_TAKEN = 'Another product already uses that barcode',
  PRODUCTS_IMPORTED = 'Products imported successfully',

  CATEGORY_CREATED = 'Category created successfully',
  CATEGORIES_FETCHED = 'Categories fetched successfully',
  CATEGORY_UPDATED = 'Category updated successfully',
  CATEGORY_DELETED = 'Category deleted successfully',
  CATEGORY_NOT_FOUND = 'Category not found',
  CATEGORY_NAME_TAKEN = 'A category with that name already exists',
  CATEGORY_IN_USE = 'Products still use this category',

  PRICE_BELOW_MINIMUM = 'That price is below the product’s minimum',
  PRODUCT_LIMIT_REACHED = 'Your plan does not allow any more products',
}
