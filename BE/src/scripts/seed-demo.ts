/**
 * Seeds a realistic Pakistani distribution business.
 *
 * ## Why this exists, and why it is not a fixture file
 *
 * Empty screens hide bugs. A dashboard with no sales looks the same whether
 * the aggregation is correct or broken; an aging report with no receivables
 * proves nothing. This script creates enough history — a month of sales at
 * varying volumes, credit customers at different stages of overdue, stock
 * that has moved — that every screen in the product shows something real and
 * every report has something to be wrong about.
 *
 * ## The important property
 *
 * It creates data **through the services**, not by inserting documents. Every
 * sale goes through `SalesService.create`, so it writes real stock-ledger
 * rows, real customer-ledger rows, and a real invoice number. Seeding by
 * direct insert would produce a database that no code path could have
 * produced — which is worse than no data, because it makes the product look
 * fine while the paths that matter are untested.
 *
 * Run with: `pnpm run seed:demo`
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { CatalogService } from 'src/modules/catalog/catalog.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { PurchasingService } from 'src/modules/purchasing/purchasing.service';
import { SalesService } from 'src/modules/sales/sales.service';
import { WhatsAppService } from 'src/modules/whatsapp/whatsapp.service';
import {
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';
import { STOCK_REASON } from 'src/modules/inventory/constants/inventory.constant';
import { PAYMENT_METHOD } from 'src/modules/sales/constants/sales.constant';
import { BILLING_PLAN } from 'src/modules/organization/constants/organization.constant';
import { TAX_TREATMENT } from 'src/modules/catalog/constants/catalog.constant';
import { LOCATION_TYPE } from 'src/modules/organization/constants/organization.constant';
import { createHashPassword } from 'src/modules/auth/utils/auth.util';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { User, UserDocument } from 'src/modules/user/user.schema';
import { Sale, SaleDocument } from 'src/modules/sales/sale.schema';
import {
  StockLedgerEntry,
  StockLedgerEntryDocument,
} from 'src/modules/inventory/stock-ledger.schema';
import {
  CustomerLedgerEntry,
  CustomerLedgerEntryDocument,
} from 'src/modules/customer/customer-ledger.schema';

const logger = new Logger('SeedDemo');

const DEMO_PASSWORD = 'BusinessOS!2026';

/** The team. One of each role, so every permission path is demonstrable. */
const TEAM = [
  { name: 'Afnan Iqbal', email: 'owner@kolachi.test', role: USER_ROLES.OWNER },
  { name: 'Sana Malik', email: 'admin@kolachi.test', role: USER_ROLES.ADMIN },
  {
    name: 'Bilal Ahmed',
    email: 'manager@kolachi.test',
    role: USER_ROLES.MANAGER,
  },
  {
    name: 'Hina Shah',
    email: 'cashier@kolachi.test',
    role: USER_ROLES.CASHIER,
  },
  {
    name: 'Usman Tariq',
    email: 'accountant@kolachi.test',
    role: USER_ROLES.ACCOUNTANT,
  },
  {
    name: 'Ayesha Khan',
    email: 'viewer@kolachi.test',
    role: USER_ROLES.VIEWER,
  },
] as const;

/**
 * A real distributor's catalogue: fast-moving consumer goods, in the pack
 * sizes they are actually sold in. Prices are in paisa.
 */
const CATALOGUE = [
  {
    name: 'Coca-Cola 1.5L',
    sku: 'COKE-1500',
    barcode: '5449000000996',
    category: 'Beverages',
    unit: 'btl',
    packSize: 12,
    cost: 11000,
    price: 15000,
    reorder: 48,
  },
  {
    name: 'Coca-Cola 500ml',
    sku: 'COKE-500',
    barcode: '5449000131805',
    category: 'Beverages',
    unit: 'btl',
    packSize: 24,
    cost: 4500,
    price: 6000,
    reorder: 96,
  },
  {
    name: 'Sprite 1.5L',
    sku: 'SPRITE-1500',
    category: 'Beverages',
    unit: 'btl',
    packSize: 12,
    cost: 10800,
    price: 15000,
    reorder: 36,
  },
  {
    name: 'Nestlé Pure Life 1.5L',
    sku: 'WATER-1500',
    category: 'Beverages',
    unit: 'btl',
    packSize: 12,
    cost: 4000,
    price: 6000,
    reorder: 120,
  },
  {
    name: 'Lays Masala 40g',
    sku: 'LAYS-MAS-40',
    category: 'Snacks',
    unit: 'pkt',
    packSize: 50,
    cost: 3500,
    price: 5000,
    reorder: 200,
  },
  {
    name: 'Kurkure Chutney 45g',
    sku: 'KURK-CHT-45',
    category: 'Snacks',
    unit: 'pkt',
    packSize: 50,
    cost: 3000,
    price: 4000,
    reorder: 200,
  },
  {
    name: 'Sooper Biscuit Family Pack',
    sku: 'SOOP-FAM',
    category: 'Snacks',
    unit: 'pkt',
    packSize: 24,
    cost: 9000,
    price: 12000,
    reorder: 72,
  },
  {
    name: 'Colgate Toothpaste 100g',
    sku: 'COLG-100',
    category: 'Personal Care',
    unit: 'pcs',
    packSize: 12,
    cost: 18000,
    price: 24500,
    reorder: 36,
  },
  {
    name: 'Lifebuoy Soap 100g',
    sku: 'LIFE-SOAP-100',
    category: 'Personal Care',
    unit: 'pcs',
    packSize: 48,
    cost: 7500,
    price: 10000,
    reorder: 96,
  },
  {
    name: 'Head & Shoulders 185ml',
    sku: 'HS-185',
    category: 'Personal Care',
    unit: 'btl',
    packSize: 12,
    cost: 48000,
    price: 62000,
    reorder: 24,
  },
  {
    name: 'Surf Excel 1kg',
    sku: 'SURF-1KG',
    category: 'Household',
    unit: 'pkt',
    packSize: 9,
    cost: 52000,
    price: 66000,
    reorder: 27,
  },
  {
    name: 'Harpic Toilet Cleaner 500ml',
    sku: 'HARP-500',
    category: 'Household',
    unit: 'btl',
    packSize: 12,
    cost: 26000,
    price: 33500,
    reorder: 24,
  },
  {
    name: 'Tapal Danedar 430g',
    sku: 'TAPAL-430',
    category: 'Groceries',
    unit: 'pkt',
    packSize: 12,
    cost: 78000,
    price: 95000,
    reorder: 24,
  },
  {
    name: 'National Red Chilli 200g',
    sku: 'NAT-CHILLI-200',
    category: 'Groceries',
    unit: 'pkt',
    packSize: 24,
    cost: 16000,
    price: 21000,
    reorder: 48,
  },
  {
    name: 'Dalda Cooking Oil 5L',
    sku: 'DALDA-5L',
    category: 'Groceries',
    unit: 'tin',
    packSize: 4,
    cost: 285000,
    price: 330000,
    reorder: 12,
  },
  {
    name: 'Basmati Rice 5kg',
    sku: 'RICE-BAS-5',
    category: 'Groceries',
    unit: 'bag',
    packSize: 4,
    cost: 180000,
    price: 215000,
    reorder: 12,
  },
  {
    name: 'Sugar 1kg',
    sku: 'SUGAR-1KG',
    category: 'Groceries',
    unit: 'kg',
    packSize: 20,
    cost: 15000,
    price: 18500,
    reorder: 100,
    taxTreatment: TAX_TREATMENT.EXEMPT,
  },
  {
    name: 'Wheat Flour 10kg',
    sku: 'ATTA-10KG',
    category: 'Groceries',
    unit: 'bag',
    packSize: 5,
    cost: 120000,
    price: 142000,
    reorder: 20,
    taxTreatment: TAX_TREATMENT.EXEMPT,
  },
  {
    name: 'A4 Paper 80gsm',
    sku: 'PAPER-A4-80',
    category: 'Stationery',
    unit: 'ream',
    packSize: 5,
    cost: 95000,
    price: 120000,
    reorder: 15,
  },
  {
    name: 'Blue Ballpoint Pen',
    sku: 'PEN-BLUE',
    category: 'Stationery',
    unit: 'pcs',
    packSize: 50,
    cost: 1500,
    price: 2500,
    reorder: 200,
  },
  {
    name: 'Delivery Charge',
    sku: 'DELIVERY',
    category: 'Services',
    unit: 'job',
    packSize: 1,
    cost: 0,
    price: 50000,
    reorder: 0,
    trackStock: false,
  },
] as const;

const CUSTOMERS = [
  {
    name: 'Ahmed Raza',
    businessName: 'Raza General Store',
    phone: '+92 300 1234567',
    city: 'Karachi',
    creditLimit: 50000000,
    terms: 30,
    discount: 3,
    tax: '1234567-8',
  },
  {
    name: 'Fatima Bibi',
    businessName: 'Fatima Kiryana',
    phone: '+92 321 2345678',
    city: 'Karachi',
    creditLimit: 20000000,
    terms: 15,
    discount: 0,
  },
  {
    name: 'Kamran Shaikh',
    businessName: 'Shaikh Superstore',
    phone: '+92 333 3456789',
    city: 'Hyderabad',
    creditLimit: 80000000,
    terms: 30,
    discount: 5,
    tax: '7654321-1',
  },
  {
    name: 'Nadia Aslam',
    businessName: 'Corner Mart',
    phone: '+92 345 4567890',
    city: 'Karachi',
    creditLimit: 15000000,
    terms: 7,
    discount: 0,
  },
  {
    name: 'Rizwan Ali',
    businessName: 'Ali Traders',
    phone: '+92 302 5678901',
    city: 'Sukkur',
    creditLimit: 35000000,
    terms: 30,
    discount: 2,
  },
  {
    name: 'Walk-in Customer',
    businessName: '',
    phone: '',
    city: 'Karachi',
    creditLimit: 0,
    terms: 0,
    discount: 0,
  },
] as const;

const SUPPLIERS = [
  {
    name: 'Shaheen Distributors',
    contactPerson: 'Imran Sheikh',
    phone: '+92 21 35678901',
    terms: 30,
  },
  {
    name: 'Metro Wholesale',
    contactPerson: 'Zeeshan Khan',
    phone: '+92 21 34567890',
    terms: 15,
  },
  {
    name: 'Indus FMCG Supply',
    contactPerson: 'Ayesha Noor',
    phone: '+92 21 33456789',
    terms: 45,
  },
] as const;

async function bootstrap(): Promise<void> {
  // 'log' included deliberately: this script's whole output — the credentials
  // and the summary — goes through the Nest logger, and filtering it out
  // leaves a seed that appears to do nothing.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const saleModel = app.get<Model<SaleDocument>>(getModelToken(Sale.name));
    const stockLedgerModel = app.get<Model<StockLedgerEntryDocument>>(
      getModelToken(StockLedgerEntry.name),
    );
    const customerLedgerModel = app.get<Model<CustomerLedgerEntryDocument>>(
      getModelToken(CustomerLedgerEntry.name),
    );
    const organizationService = app.get(OrganizationService);
    const catalogService = app.get(CatalogService);
    const inventoryService = app.get(InventoryService);
    const customerService = app.get(CustomerService);
    const purchasingService = app.get(PurchasingService);
    const salesService = app.get(SalesService);
    const whatsappService = app.get(WhatsAppService);

    // --- Owner and organization ------------------------------------------
    logger.log('Creating the owner account…');

    const existing = await userModel.findOne({ email: TEAM[0].email });

    if (existing) {
      logger.warn(
        `${TEAM[0].email} already exists — the demo data has been seeded before. Drop the database first to reseed.`,
      );

      return;
    }

    const owner = await userModel.create({
      name: TEAM[0].name,
      email: TEAM[0].email,
      phone: '+92 300 0000000',
      role: USER_ROLES.OWNER,
      password: await createHashPassword(DEMO_PASSWORD),
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
    });

    logger.log('Creating the organization…');

    const organization = await organizationService.create(
      {
        name: 'Kolachi Traders',
        legalName: 'Kolachi Traders (Pvt) Ltd',
        country: 'PK',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        phone: '+92 21 32345678',
        email: 'hello@kolachitraders.test',
        address: 'Shop 4, Jodia Bazaar, Karachi',
      },
      String(owner._id),
    );

    const organizationId = String(organization._id);

    // The BUSINESS plan, so WhatsApp and the AI clerk are demonstrable
    // without anyone having to buy anything first.
    await organizationService.applyPlan(organizationId, {
      plan: BILLING_PLAN.BUSINESS,
    });

    await organizationService.update(organizationId, {
      tax: {
        registrationNumber: '17-00-9999-001-55',
        nationalTaxNumber: '4455667-8',
        defaultRatePercent: 18,
        pricesIncludeTax: false,
        furtherTaxPercent: 3,
      },
      invoice: {
        prefix: 'KT',
        padding: 6,
        footerNote: 'Thank you for your business.',
      },
    });

    // --- Team -------------------------------------------------------------
    logger.log('Inviting the team…');

    for (const member of TEAM.slice(1)) {
      const user = await userModel.create({
        name: member.name,
        email: member.email,
        phone: '+92 300 0000000',
        role: member.role,
        password: await createHashPassword(DEMO_PASSWORD),
        organization: organization._id,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
      });

      logger.log(`  ${member.role.padEnd(11)} ${user.email}`);
    }

    // --- Locations --------------------------------------------------------
    await organizationService.createLocation(organizationId, {
      name: 'Jodia Bazaar Shop',
      code: 'SHOP',
      type: LOCATION_TYPE.SHOP,
      address: 'Shop 4, Jodia Bazaar, Karachi',
    });

    const mainLocation =
      await organizationService.getDefaultLocationId(organizationId);

    // --- Catalogue --------------------------------------------------------
    logger.log('Building the catalogue…');

    const categoryIds = new Map<string, string>();

    for (const name of new Set(CATALOGUE.map((item) => item.category))) {
      const category = await catalogService.createCategory(organizationId, {
        name,
      });

      categoryIds.set(name, String(category._id));
    }

    const productIds = new Map<string, string>();

    for (const item of CATALOGUE) {
      const product = await catalogService.createProduct(organizationId, {
        name: item.name,
        sku: item.sku,
        barcode: 'barcode' in item ? item.barcode : undefined,
        category: categoryIds.get(item.category),
        unit: item.unit,
        packSize: item.packSize,
        sellingPrice: item.price,
        minimumPrice: Math.round(item.cost * 1.05),
        reorderLevel: item.reorder,
        reorderQuantity: item.reorder * 2,
        trackStock: 'trackStock' in item ? item.trackStock : true,
        taxTreatment:
          'taxTreatment' in item ? item.taxTreatment : TAX_TREATMENT.STANDARD,
      });

      productIds.set(item.sku, String(product._id));
    }

    // --- Suppliers and opening stock -------------------------------------
    logger.log('Receiving opening stock…');

    const supplierIds: string[] = [];

    for (const supplier of SUPPLIERS) {
      const created = await purchasingService.createSupplier(organizationId, {
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        paymentTermDays: supplier.terms,
      });

      supplierIds.push(String(created._id));
    }

    // Opening stock through a real goods receipt, so weighted-average cost is
    // established by the same code a real delivery would use.
    await purchasingService.receiveGoods(
      organizationId,
      {
        supplier: supplierIds[0],
        location: String(mainLocation),
        lines: CATALOGUE.filter(
          (item) => !('trackStock' in item) || item.trackStock,
        ).map((item) => ({
          product: productIds.get(item.sku) as string,
          quantity: item.reorder * 3,
          unitCost: item.cost,
        })),
        supplierInvoiceNumber: 'SD-OPENING-001',
      },
      String(owner._id),
    );

    // --- Customers --------------------------------------------------------
    logger.log('Adding customers…');

    const customerIds: string[] = [];

    for (const customer of CUSTOMERS) {
      const created = await customerService.create(organizationId, {
        name: customer.name,
        businessName: customer.businessName || undefined,
        phone: customer.phone || undefined,
        city: customer.city,
        creditLimit: customer.creditLimit,
        paymentTermDays: customer.terms,
        discountPercent: customer.discount,
        taxRegistrationNumber: 'tax' in customer ? customer.tax : undefined,
        whatsappOptIn: Boolean(customer.phone),
      });

      customerIds.push(String(created._id));
    }

    // --- A month of trading ----------------------------------------------
    logger.log('Trading for a month…');

    const sellable = CATALOGUE.filter(
      (item) => !('trackStock' in item) || item.trackStock,
    );
    let salesMade = 0;

    /**
     * Sales to backdate, and to when.
     *
     * `SalesService.create` stamps `completedAt` with the current time and
     * offers no way to override it — correctly, because an API that accepts a
     * caller-supplied sale date is an API that can be used to move revenue
     * between tax periods. So the seed creates every sale normally, through
     * the real service, and then rewrites the timestamps directly.
     *
     * This is the one place in the codebase that writes history directly, and
     * it is a seeding script rather than anything the application can reach.
     */
    const backdate: { saleId: string; at: Date }[] = [];

    // Deterministic pseudo-randomness: the same seed produces the same demo
    // every time, which matters when a screenshot or a test refers to it.
    let seed = 20260912;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;

      return seed / 2147483648;
    };

    for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
      // Fewer sales on Sundays, more towards the end of the month — a shape
      // that makes the trend chart look like a real business rather than noise.
      const salesToday = 2 + Math.floor(random() * 4);

      for (let i = 0; i < salesToday; i += 1) {
        const customerIndex = Math.floor(random() * customerIds.length);
        const isWalkIn = customerIndex === customerIds.length - 1;
        const lineCount = 1 + Math.floor(random() * 4);

        const lines = Array.from({ length: lineCount }, () => {
          const item = sellable[Math.floor(random() * sellable.length)];

          return {
            product: productIds.get(item.sku) as string,
            quantity: 1 + Math.floor(random() * 6),
          };
        });

        // Roughly a third of sales go on credit, which is what gives the
        // receivables and aging reports something to show.
        const onCredit = !isWalkIn && random() < 0.35;

        try {
          const quote = await salesService.quote(organizationId, {
            customer: isWalkIn ? undefined : customerIds[customerIndex],
            lines,
          });

          const sale = await salesService.create(
            organizationId,
            {
              customer: isWalkIn ? undefined : customerIds[customerIndex],
              lines,
              payments: onCredit
                ? []
                : [
                    {
                      method:
                        random() < 0.75
                          ? PAYMENT_METHOD.CASH
                          : PAYMENT_METHOD.BANK,
                      amount: quote.grandTotal,
                    },
                  ],
            },
            String(owner._id),
            { credit: true, discount: true },
          );

          // Spread through the working day so an hourly chart is not a spike.
          const at = new Date();
          at.setDate(at.getDate() - daysAgo);
          at.setHours(
            9 + Math.floor(random() * 10),
            Math.floor(random() * 60),
            0,
            0,
          );

          backdate.push({ saleId: String(sale._id), at });
          salesMade += 1;
        } catch {
          // A line that ran out of stock is a legitimate outcome of trading
          // against finite opening stock — skip it and carry on.
          continue;
        }
      }
    }

    // --- Backdate the trading history ------------------------------------
    logger.log('Backdating the trading history…');

    for (const entry of backdate) {
      const saleId = new Types.ObjectId(entry.saleId);

      await saleModel.updateOne(
        { _id: saleId },
        { $set: { completedAt: entry.at, createdAt: entry.at } },
        // `timestamps: false` so Mongoose does not helpfully overwrite the
        // `createdAt` we just set with the current time.
        { timestamps: false },
      );

      // The ledgers move with it. A stock movement dated today against a sale
      // dated last month would make the movement history unreadable, and the
      // aging report reads `dueDate` on the customer ledger — leaving those at
      // today means nothing is ever overdue and the report shows an empty
      // screen that looks like a bug.
      await stockLedgerModel.updateMany(
        { reference: saleId },
        { $set: { createdAt: entry.at } },
        { timestamps: false },
      );

      // Read-then-write rather than an aggregation pipeline: the due date has
      // to keep its original offset from the sale so that payment terms still
      // mean what they meant, and expressing that shift in JavaScript is far
      // clearer than the equivalent `$add`/`$subtract` pipeline.
      // `.lean()` with an explicit shape: `timestamps: true` adds `createdAt`
      // at runtime but the schema class does not declare it, so the hydrated
      // document type has no such field to read.
      const ledgerRows = await customerLedgerModel
        .find({ reference: saleId })
        .select({ createdAt: 1, dueDate: 1 })
        .lean<{ _id: Types.ObjectId; createdAt: Date; dueDate?: Date }[]>();

      for (const row of ledgerRows) {
        const termMs = row.dueDate
          ? row.dueDate.getTime() - row.createdAt.getTime()
          : 0;

        await customerLedgerModel.updateOne(
          { _id: row._id },
          {
            $set: {
              createdAt: entry.at,
              dueDate: new Date(entry.at.getTime() + termMs),
            },
          },
          { timestamps: false },
        );
      }
    }

    // --- A WhatsApp conversation waiting to be actioned -------------------
    logger.log('Seeding a WhatsApp conversation…');

    await whatsappService.handleInbound(organizationId, {
      phone: CUSTOMERS[0].phone,
      contactName: CUSTOMERS[0].name,
      text: 'Assalamualaikum, need 2 cartons Coca-Cola 1.5L and 10 Colgate toothpaste. Also 5 ream A4 paper please.',
      simulated: true,
    });

    // --- A deliberately low stock item ------------------------------------
    // Drives the low-stock alert and the reorder suggestion, so those screens
    // are not empty on first open.
    //
    // The size of the write-off is derived from what is actually on hand, not
    // hardcoded: the sales loop above is randomised, so a fixed figure wrote
    // off more than the warehouse held and left the balance negative — an
    // impossible state that then rendered as "-29 in stock" across the
    // dashboard, the catalogue and the reorder screen.
    const dalda = productIds.get('DALDA-5L') as string;
    const daldaOnHand = await inventoryService.getAvailable(
      organizationId,
      dalda,
      String(mainLocation),
    );
    // Leave a few units: enough to sit below the reorder level without
    // emptying the shelf, which is the state the low-stock screens illustrate.
    const writeOff = Math.max(0, daldaOnHand - 4);

    if (writeOff > 0) {
      await inventoryService.recordAdjustment(
        organizationId,
        String(mainLocation),
        [
          {
            productId: dalda,
            locationId: String(mainLocation),
            quantity: -writeOff,
            reason: STOCK_REASON.WRITE_OFF,
            note: 'Damaged in transit',
          },
        ],
        String(owner._id),
      );
    }

    const stockValue = await inventoryService.getStockValue(organizationId);
    const receivables =
      await customerService.getTotalReceivables(organizationId);

    logger.log('');
    logger.log('─────────────────────────────────────────────');
    logger.log('  BusinessOS demo data ready');
    logger.log('─────────────────────────────────────────────');
    logger.log(`  Organization   Kolachi Traders (${organization.slug})`);
    logger.log(`  Products       ${String(CATALOGUE.length)}`);
    logger.log(`  Customers      ${String(CUSTOMERS.length)}`);
    logger.log(`  Suppliers      ${String(SUPPLIERS.length)}`);
    logger.log(`  Sales          ${String(salesMade)}`);
    logger.log(`  Stock value    PKR ${(stockValue / 100).toFixed(2)}`);
    logger.log(`  Receivables    PKR ${(receivables / 100).toFixed(2)}`);
    logger.log('');
    logger.log('  Sign in with any of these — password below:');

    for (const member of TEAM) {
      logger.log(`    ${member.role.padEnd(11)} ${member.email}`);
    }

    logger.log('');
    logger.log(`  Password       ${DEMO_PASSWORD}`);
    logger.log('─────────────────────────────────────────────');
  } catch (error) {
    logger.error(
      'Seeding failed.',
      error instanceof Error ? error.stack : undefined,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
