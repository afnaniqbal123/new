import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { CatalogController } from 'src/modules/catalog/catalog.controller';
import { Product, ProductSchema } from 'src/modules/catalog/product.schema';
import { Category, CategorySchema } from 'src/modules/catalog/category.schema';
import { CatalogPolicy } from 'src/modules/catalog/policies/catalog.policy';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * Owns `Product` and `Category`, including the cached stock fields that
 * `InventoryService` computes and writes back through this service.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    // For plan limits, currency and tax defaults. Imported, never re-provided.
    OrganizationModule,
    AuthModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogPolicy],
  exports: [CatalogService],
})
export class CatalogModule {}
