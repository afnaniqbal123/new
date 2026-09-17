import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from 'src/modules/catalog/dto/catalog.dto';
import { CATALOG_RESPONSE } from 'src/modules/catalog/constants/api-response/catalog.response';
import {
  CATEGORY_SUBJECT,
  PRODUCT_COST_SUBJECT,
  PRODUCT_SUBJECT,
} from 'src/modules/catalog/constants/catalog.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { stripCostFields } from 'src/modules/catalog/utils/strip-cost-fields.util';

@Controller('catalog')
@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // --- Products ----------------------------------------------------------

  @Get('products')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: PRODUCT_SUBJECT })
  async listProducts(
    @GetOrganizationId() organizationId: string,
    @Query() query: ProductQueryDto,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const { items, total } = await this.catalogService.findProducts(
      organizationId,
      query,
    );

    // Cost is a separate subject from the product. A cashier reads the record
    // and not these fields — see CatalogPolicy for why.
    const visible = stripCostFields(items, ability);

    return SerializeHttpResponse(
      {
        items: visible,
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
      },
      200,
      CATALOG_RESPONSE.PRODUCTS_FETCHED,
    );
  }

  @Get('products/barcode/:barcode')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: PRODUCT_SUBJECT })
  async findByBarcode(
    @GetOrganizationId() organizationId: string,
    @Param('barcode') barcode: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const product = await this.catalogService.findByBarcode(
      organizationId,
      barcode,
    );

    return SerializeHttpResponse(
      stripCostFields(product, ability),
      200,
      CATALOG_RESPONSE.PRODUCT_FETCHED,
    );
  }

  @Get('products/low-stock')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: PRODUCT_SUBJECT })
  async lowStock(
    @GetOrganizationId() organizationId: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const products = await this.catalogService.findLowStock(organizationId);

    return SerializeHttpResponse(
      stripCostFields(products, ability),
      200,
      CATALOG_RESPONSE.PRODUCTS_FETCHED,
    );
  }

  @Get('products/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: PRODUCT_SUBJECT })
  async findProduct(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    const product = await this.catalogService.findProductById(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      stripCostFields(product, ability),
      200,
      CATALOG_RESPONSE.PRODUCT_FETCHED,
    );
  }

  @Post('products')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: PRODUCT_SUBJECT })
  async createProduct(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateProductDto,
  ) {
    const product = await this.catalogService.createProduct(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      product,
      201,
      CATALOG_RESPONSE.PRODUCT_CREATED,
    );
  }

  @Patch('products/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: PRODUCT_SUBJECT })
  async updateProduct(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.catalogService.updateProduct(
      organizationId,
      id,
      dto,
    );

    return SerializeHttpResponse(
      product,
      200,
      CATALOG_RESPONSE.PRODUCT_UPDATED,
    );
  }

  @Delete('products/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Delete, subject: PRODUCT_SUBJECT })
  async archiveProduct(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const product = await this.catalogService.archiveProduct(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      product,
      200,
      CATALOG_RESPONSE.PRODUCT_DELETED,
    );
  }

  // --- Categories --------------------------------------------------------

  @Get('categories')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: CATEGORY_SUBJECT })
  async listCategories(@GetOrganizationId() organizationId: string) {
    const categories = await this.catalogService.findCategories(organizationId);

    return SerializeHttpResponse(
      categories,
      200,
      CATALOG_RESPONSE.CATEGORIES_FETCHED,
    );
  }

  @Post('categories')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: CATEGORY_SUBJECT })
  async createCategory(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    const category = await this.catalogService.createCategory(
      organizationId,
      dto,
    );

    return SerializeHttpResponse(
      category,
      201,
      CATALOG_RESPONSE.CATEGORY_CREATED,
    );
  }

  @Patch('categories/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: CATEGORY_SUBJECT })
  async updateCategory(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.catalogService.updateCategory(
      organizationId,
      id,
      dto,
    );

    return SerializeHttpResponse(
      category,
      200,
      CATALOG_RESPONSE.CATEGORY_UPDATED,
    );
  }

  @Delete('categories/:id')
  @TenantScoped()
  @RequirePermissions({ action: Action.Delete, subject: CATEGORY_SUBJECT })
  async deleteCategory(
    @GetOrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    const category = await this.catalogService.deleteCategory(
      organizationId,
      id,
    );

    return SerializeHttpResponse(
      category,
      200,
      CATALOG_RESPONSE.CATEGORY_DELETED,
    );
  }

  /**
   * Declared so the cost subject is reachable by an explicit capability check
   * from the frontend, rather than the UI guessing which roles see margin.
   */
  @Get('can-see-cost')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: PRODUCT_COST_SUBJECT })
  canSeeCost() {
    return SerializeHttpResponse(
      { allowed: true },
      200,
      CATALOG_RESPONSE.PRODUCT_FETCHED,
    );
  }
}
