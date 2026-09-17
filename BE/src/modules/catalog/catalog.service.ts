import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Product, ProductDocument } from 'src/modules/catalog/product.schema';
import {
  Category,
  CategoryDocument,
} from 'src/modules/catalog/category.schema';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from 'src/modules/catalog/dto/catalog.dto';
import { CATALOG_RESPONSE } from 'src/modules/catalog/constants/api-response/catalog.response';
import { PRODUCT_STATUS } from 'src/modules/catalog/constants/catalog.constant';
import { SerializeHttpError } from 'src/utils/serializer';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { ProductView } from 'src/modules/catalog/types/product-view.type';

/**
 * Owns the catalogue: `Product` and `Category`.
 *
 * Also owns the two *cached* stock fields on a product — `stockOnHand` and
 * `averageCost`. `InventoryService` computes them from the ledger and calls
 * `applyStockDelta`/`setStockOnHand` here to store them, rather than writing
 * the Product collection itself, because a collection has exactly one owning
 * module (`nestjs/no-foreign-schema-read`).
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly organizationService: OrganizationService,
  ) {}

  // --- Products ----------------------------------------------------------

  async createProduct(
    organizationId: string,
    dto: CreateProductDto,
  ): Promise<ProductDocument> {
    await this.assertProductLimit(organizationId);
    await this.assertSkuFree(organizationId, dto.sku);

    if (dto.barcode) {
      await this.assertBarcodeFree(organizationId, dto.barcode);
    }

    return this.productModel.create({
      ...dto,
      organization: new Types.ObjectId(organizationId),
      category: dto.category ? new Types.ObjectId(dto.category) : undefined,
      preferredSupplier: dto.preferredSupplier
        ? new Types.ObjectId(dto.preferredSupplier)
        : undefined,
    });
  }

  /**
   * Product limits are counted here rather than in `OrganizationService`,
   * because this module owns the collection being counted. The plan itself
   * still comes from there, so the limit lives in exactly one table.
   */
  private async assertProductLimit(organizationId: string): Promise<void> {
    const limits = await this.organizationService.getPlanLimits(organizationId);

    if (limits.products === null) return;

    const current = await this.productModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      status: { $ne: PRODUCT_STATUS.ARCHIVED },
    });

    if (current < limits.products) return;

    return SerializeHttpError(
      null,
      HttpStatus.PAYMENT_REQUIRED,
      CATALOG_RESPONSE.PRODUCT_LIMIT_REACHED,
    );
  }

  async findProducts(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<{ items: ProductDocument[]; total: number }> {
    // A plain record rather than a Mongoose filter generic: Mongoose 9 no
    // longer exports `FilterQuery`, and `$expr`/`$or` below are not
    // expressible in the strict per-field filter type that replaced it.
    const filter: Record<string, unknown> = {
      organization: new Types.ObjectId(organizationId),
    };

    // An archived product still resolves by id (sales history references it)
    // but never appears in a list unless explicitly asked for.
    filter.status = query.status ?? { $ne: PRODUCT_STATUS.ARCHIVED };

    if (query.category) {
      filter.category = new Types.ObjectId(query.category);
    }

    if (query.search) {
      // A regex rather than the text index: a counter clerk types a fragment
      // of a SKU ("col-1") and expects a hit, which `$text` word-matching
      // does not give. Escaped so a stray `(` cannot throw.
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [{ name: pattern }, { sku: pattern }, { barcode: pattern }];
    }

    if (query.lowStock) {
      filter.trackStock = true;
      filter.$expr = { $lte: ['$stockOnHand', '$reorderLevel'] };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('category', 'name color'),
      this.productModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findProductById(
    organizationId: string,
    productId: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel
      .findOne({
        _id: new Types.ObjectId(productId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('category', 'name color');

    if (!product) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CATALOG_RESPONSE.PRODUCT_NOT_FOUND,
      );
    }

    return product;
  }

  /**
   * Resolves many products at once, keyed by id.
   *
   * Exists so the sale and stock paths can validate a whole basket in one
   * query. Returns a Map rather than an array so callers cannot accidentally
   * rely on ordering that Mongo does not promise.
   */
  async findManyByIds(
    organizationId: string,
    productIds: readonly string[],
  ): Promise<Map<string, ProductView>> {
    if (productIds.length === 0) return new Map();

    const products = await this.productModel.find({
      organization: new Types.ObjectId(organizationId),
      _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    });

    return new Map(
      products.map((product) => [String(product._id), toProductView(product)]),
    );
  }

  /** Barcode lookup for the scanner at the counter. */
  async findByBarcode(
    organizationId: string,
    barcode: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      organization: new Types.ObjectId(organizationId),
      barcode,
      status: { $ne: PRODUCT_STATUS.ARCHIVED },
    });

    if (!product) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CATALOG_RESPONSE.PRODUCT_NOT_FOUND,
      );
    }

    return product;
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDocument> {
    if (dto.sku) {
      await this.assertSkuFree(organizationId, dto.sku, productId);
    }

    if (dto.barcode) {
      await this.assertBarcodeFree(organizationId, dto.barcode, productId);
    }

    const product = await this.productModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(productId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: dto },
      { returnDocument: 'after' },
    );

    if (!product) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CATALOG_RESPONSE.PRODUCT_NOT_FOUND,
      );
    }

    return product;
  }

  /**
   * Archives a product. Never a hard delete — every historical sale line
   * references it, and those must keep resolving to a name and a SKU.
   */
  async archiveProduct(
    organizationId: string,
    productId: string,
  ): Promise<ProductDocument> {
    return this.updateProduct(organizationId, productId, {
      status: PRODUCT_STATUS.ARCHIVED,
    });
  }

  private async assertSkuFree(
    organizationId: string,
    sku: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.productModel.exists({
      organization: new Types.ObjectId(organizationId),
      sku: sku.toUpperCase(),
      ...(exceptId ? { _id: { $ne: new Types.ObjectId(exceptId) } } : {}),
    });

    if (clash) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CATALOG_RESPONSE.SKU_TAKEN,
      );
    }
  }

  private async assertBarcodeFree(
    organizationId: string,
    barcode: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.productModel.exists({
      organization: new Types.ObjectId(organizationId),
      barcode,
      ...(exceptId ? { _id: { $ne: new Types.ObjectId(exceptId) } } : {}),
    });

    if (clash) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CATALOG_RESPONSE.BARCODE_TAKEN,
      );
    }
  }

  // --- Cached stock fields ----------------------------------------------
  //
  // Written only by InventoryService, which computes them from the ledger.
  // They live on Product for list-screen speed; the ledger remains the truth.

  async applyStockDelta(
    organizationId: string,
    productId: string,
    delta: number,
    averageCost: number | undefined,
    session?: ClientSession,
  ): Promise<void> {
    const update: Record<string, unknown> = { $inc: { stockOnHand: delta } };

    if (averageCost !== undefined) {
      update.$set = { averageCost };
    }

    await this.productModel.updateOne(
      {
        _id: new Types.ObjectId(productId),
        organization: new Types.ObjectId(organizationId),
      },
      update,
      { session },
    );
  }

  async setStockOnHand(
    organizationId: string,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await this.productModel.updateOne(
      {
        _id: new Types.ObjectId(productId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: { stockOnHand: quantity } },
    );
  }

  async setLastPurchasePrice(
    organizationId: string,
    productId: string,
    price: number,
  ): Promise<void> {
    await this.productModel.updateOne(
      {
        _id: new Types.ObjectId(productId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: { lastPurchasePrice: price } },
    );
  }

  /** Total stock value at weighted-average cost, in minor units. */
  async getStockValue(organizationId: string): Promise<number> {
    const [result] = await this.productModel.aggregate<{ total: number }>([
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          trackStock: true,
          status: { $ne: PRODUCT_STATUS.ARCHIVED },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$stockOnHand', '$averageCost'] } },
        },
      },
    ]);

    return Math.round(result?.total ?? 0);
  }

  /** Products at or below their reorder level — the low-stock alert source. */
  async findLowStock(
    organizationId: string,
    limit = 50,
  ): Promise<ProductView[]> {
    const products = await this.productModel
      .find({
        organization: new Types.ObjectId(organizationId),
        trackStock: true,
        status: PRODUCT_STATUS.ACTIVE,
        $expr: { $lte: ['$stockOnHand', '$reorderLevel'] },
      })
      .sort({ stockOnHand: 1 })
      .limit(limit);

    return products.map(toProductView);
  }

  async countProducts(organizationId: string): Promise<number> {
    return this.productModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      status: { $ne: PRODUCT_STATUS.ARCHIVED },
    });
  }

  // --- Categories --------------------------------------------------------

  async createCategory(
    organizationId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    const clash = await this.categoryModel.exists({
      organization: new Types.ObjectId(organizationId),
      name: dto.name,
    });

    if (clash) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CATALOG_RESPONSE.CATEGORY_NAME_TAKEN,
      );
    }

    return this.categoryModel.create({
      ...dto,
      organization: new Types.ObjectId(organizationId),
    });
  }

  async findCategories(organizationId: string): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ organization: new Types.ObjectId(organizationId) })
      .sort({ name: 1 });
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(categoryId),
        organization: new Types.ObjectId(organizationId),
      },
      { $set: dto },
      { returnDocument: 'after' },
    );

    if (!category) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CATALOG_RESPONSE.CATEGORY_NOT_FOUND,
      );
    }

    return category;
  }

  /**
   * Refuses to delete a category that products still reference.
   *
   * The alternative — orphaning them — leaves products that cannot be found
   * by any category filter, which looks like data loss to the person using it.
   */
  async deleteCategory(
    organizationId: string,
    categoryId: string,
  ): Promise<CategoryDocument> {
    const inUse = await this.productModel.exists({
      organization: new Types.ObjectId(organizationId),
      category: new Types.ObjectId(categoryId),
      status: { $ne: PRODUCT_STATUS.ARCHIVED },
    });

    if (inUse) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        CATALOG_RESPONSE.CATEGORY_IN_USE,
      );
    }

    const category = await this.categoryModel.findOneAndDelete({
      _id: new Types.ObjectId(categoryId),
      organization: new Types.ObjectId(organizationId),
    });

    if (!category) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        CATALOG_RESPONSE.CATEGORY_NOT_FOUND,
      );
    }

    return category;
  }
}

/**
 * Projects a stored product onto the contract other modules consume.
 *
 * One place where the storage shape meets the published shape — so a schema
 * change is a change here, not in every module that reads a product.
 */
function toProductView(product: ProductDocument): ProductView {
  return {
    id: String(product._id),
    _id: product._id,
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    packSize: product.packSize,
    averageCost: product.averageCost,
    lastPurchasePrice: product.lastPurchasePrice,
    sellingPrice: product.sellingPrice,
    minimumPrice: product.minimumPrice,
    taxTreatment: product.taxTreatment,
    taxRatePercent: product.taxRatePercent,
    stockOnHand: product.stockOnHand,
    reorderLevel: product.reorderLevel,
    reorderQuantity: product.reorderQuantity,
    trackStock: product.trackStock,
    trackBatches: product.trackBatches,
    preferredSupplier: product.preferredSupplier ?? null,
  };
}
