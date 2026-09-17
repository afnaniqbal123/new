import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Organization,
  OrganizationDocument,
} from 'src/modules/organization/organization.schema';
import {
  Location,
  LocationDocument,
} from 'src/modules/organization/location.schema';
import {
  CreateLocationDto,
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateLocationDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from 'src/modules/organization/dto/organization.dto';
import { ORGANIZATION_RESPONSE } from 'src/modules/organization/constants/api-response/organization.response';
import {
  BILLING_PLAN,
  LOCATION_TYPE,
  ORGANIZATION_STATUS,
  PLAN_LIMITS,
  PlanLimits,
} from 'src/modules/organization/constants/organization.constant';
import { SerializeHttpError } from 'src/utils/serializer';
import { UserService } from 'src/modules/user/user.service';
import { MemberRef } from 'src/modules/user/types/member-ref.type';

/**
 * Owns the tenant: the Organization itself, its Locations, and its team.
 *
 * Every other domain module depends on this one for tenant configuration
 * (currency, tax rates, invoice numbering) and never reads the Organization
 * collection directly — `nestjs/no-foreign-schema-read` enforces that, and it
 * is why `getSettings` and `allocateInvoiceNumber` are public here rather
 * than each module doing its own lookup.
 */
@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
    private readonly userService: UserService,
  ) {}

  /**
   * Creates a tenant and its first Location, then attaches the creator.
   *
   * The default Location is created unconditionally. A tenant with no
   * location cannot receive stock, and discovering that at the first goods
   * receipt is a worse failure than one extra write here. CONTEXT.md D6.
   */
  async create(
    dto: CreateOrganizationDto,
    userId: string,
  ): Promise<OrganizationDocument> {
    const slug = await this.allocateSlug(dto.name);

    const organization = await this.organizationModel.create({
      ...dto,
      slug,
      createdBy: new Types.ObjectId(userId),
    });

    await this.locationModel.create({
      organization: organization._id,
      name: 'Main',
      code: 'MAIN',
      type: LOCATION_TYPE.WAREHOUSE,
      isDefault: true,
    });

    await this.userService.attachToOrganization(
      userId,
      String(organization._id),
    );

    return organization;
  }

  /**
   * Derives a unique slug from the business name.
   *
   * Collides by appending a counter rather than a random suffix: two shops
   * genuinely called "Al Madina Traders" should read as `al-madina-traders`
   * and `al-madina-traders-2`, not carry a hex blob in their URL.
   */
  private async allocateSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'workspace';

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${String(suffix + 1)}`;
      const taken = await this.organizationModel.exists({ slug: candidate });

      if (!taken) return candidate;
    }

    // 100 businesses with the same name in one deployment is not a real case;
    // falling back to a timestamp keeps it from being an outage if it happens.
    return `${base}-${String(Date.now())}`;
  }

  async findById(organizationId: string): Promise<OrganizationDocument> {
    const organization = await this.organizationModel.findById(organizationId);

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    return organization;
  }

  /**
   * Tenant configuration every other module reads.
   *
   * Returned as a plain object rather than the document so callers cannot
   * mutate and save it from outside this module.
   */
  async getSettings(organizationId: string): Promise<{
    currency: string;
    country: string;
    timezone: string;
    allowNegativeStock: boolean;
    defaultRatePercent: number;
    pricesIncludeTax: boolean;
    furtherTaxPercent: number;
    withholdingPercent: number;
    plan: BILLING_PLAN;
  }> {
    const organization = await this.findById(organizationId);

    return {
      currency: organization.currency,
      country: organization.country,
      timezone: organization.timezone,
      allowNegativeStock: organization.settings.allowNegativeStock,
      defaultRatePercent: organization.tax.defaultRatePercent,
      pricesIncludeTax: organization.tax.pricesIncludeTax,
      furtherTaxPercent: organization.tax.furtherTaxPercent,
      withholdingPercent: organization.tax.withholdingPercent,
      plan: organization.plan,
    };
  }

  /**
   * Allocates the next invoice number, atomically.
   *
   * `findOneAndUpdate` with `$inc` is the whole point: two cashiers finishing
   * a sale in the same millisecond is the ordinary case at a busy counter,
   * and a read-then-write would hand both the same legally-significant
   * number. Invariant #4.
   */
  async allocateInvoiceNumber(organizationId: string): Promise<string> {
    const organization = await this.organizationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(organizationId) },
      { $inc: { 'invoice.nextNumber': 1 } },
      { returnDocument: 'before', projection: { invoice: 1 } },
    );

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    const { prefix, nextNumber, padding } = organization.invoice;

    return `${prefix}-${String(nextNumber).padStart(padding, '0')}`;
  }

  async update(
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationDocument> {
    // Nested settings are merged field-by-field rather than replaced: a client
    // sending only `tax.defaultRatePercent` must not silently blank the
    // registration number sitting beside it.
    const update: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;

      if (key === 'tax' || key === 'invoice' || key === 'settings') {
        for (const [nestedKey, nestedValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (nestedValue !== undefined) {
            update[`${key}.${nestedKey}`] = nestedValue;
          }
        }
        continue;
      }

      update[key] = value;
    }

    const organization = await this.organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    return organization;
  }

  async setLogo(
    organizationId: string,
    url: string,
  ): Promise<OrganizationDocument> {
    const organization = await this.organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: { logo: url } },
      { returnDocument: 'after' },
    );

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    return organization;
  }

  // --- Locations ---------------------------------------------------------

  async listLocations(organizationId: string): Promise<LocationDocument[]> {
    return this.locationModel
      .find({ organization: new Types.ObjectId(organizationId) })
      .sort({ isDefault: -1, name: 1 });
  }

  /**
   * The Location a request falls back to when it names none.
   *
   * Every stock movement needs one, so this never returns null for a
   * well-formed tenant — `create` guarantees a default exists, and
   * `removeLocation` refuses to delete the last one.
   */
  async getDefaultLocationId(organizationId: string): Promise<Types.ObjectId> {
    const organizationObjectId = new Types.ObjectId(organizationId);

    const location =
      (await this.locationModel
        .findOne({ organization: organizationObjectId, isDefault: true })
        .select({ _id: 1 })) ??
      (await this.locationModel
        .findOne({ organization: organizationObjectId })
        .select({ _id: 1 })
        .sort({ createdAt: 1 }));

    if (!location) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.LOCATION_NOT_FOUND,
      );
    }

    return location._id;
  }

  async assertLocationBelongs(
    organizationId: string,
    locationId: string,
  ): Promise<Types.ObjectId> {
    const location = await this.locationModel
      .findOne({
        _id: new Types.ObjectId(locationId),
        organization: new Types.ObjectId(organizationId),
      })
      .select({ _id: 1 });

    if (!location) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.LOCATION_NOT_FOUND,
      );
    }

    return location._id;
  }

  async createLocation(
    organizationId: string,
    dto: CreateLocationDto,
  ): Promise<LocationDocument> {
    await this.assertWithinPlanLimit(organizationId, 'locations');

    if (dto.code) {
      await this.assertLocationCodeFree(organizationId, dto.code);
    }

    if (dto.isDefault) {
      await this.clearDefaultLocation(organizationId);
    }

    return this.locationModel.create({
      ...dto,
      organization: new Types.ObjectId(organizationId),
    });
  }

  async updateLocation(
    organizationId: string,
    locationId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationDocument> {
    await this.assertLocationBelongs(organizationId, locationId);

    if (dto.code) {
      await this.assertLocationCodeFree(organizationId, dto.code, locationId);
    }

    if (dto.isDefault) {
      await this.clearDefaultLocation(organizationId);
    }

    const location = await this.locationModel.findByIdAndUpdate(
      locationId,
      { $set: dto },
      { returnDocument: 'after' },
    );

    if (!location) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.LOCATION_NOT_FOUND,
      );
    }

    return location;
  }

  /**
   * Deactivates a Location rather than deleting it.
   *
   * Stock ledger rows reference it forever, and a dangling reference in an
   * immutable history is unrecoverable — the movement would lose the answer
   * to "where did this happen?". Invariant #3.
   */
  async removeLocation(
    organizationId: string,
    locationId: string,
  ): Promise<LocationDocument> {
    await this.assertLocationBelongs(organizationId, locationId);

    const remaining = await this.locationModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      isActive: true,
    });

    if (remaining <= 1) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        ORGANIZATION_RESPONSE.LAST_LOCATION,
      );
    }

    const location = await this.locationModel.findByIdAndUpdate(
      locationId,
      { $set: { isActive: false, isDefault: false } },
      { returnDocument: 'after' },
    );

    if (!location) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.LOCATION_NOT_FOUND,
      );
    }

    return location;
  }

  private async assertLocationCodeFree(
    organizationId: string,
    code: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.locationModel.exists({
      organization: new Types.ObjectId(organizationId),
      code: code.toUpperCase(),
      ...(exceptId ? { _id: { $ne: new Types.ObjectId(exceptId) } } : {}),
    });

    if (clash) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        ORGANIZATION_RESPONSE.LOCATION_CODE_TAKEN,
      );
    }
  }

  private async clearDefaultLocation(organizationId: string): Promise<void> {
    await this.locationModel.updateMany(
      { organization: new Types.ObjectId(organizationId), isDefault: true },
      { $set: { isDefault: false } },
    );
  }

  // --- Team --------------------------------------------------------------

  async listMembers(organizationId: string): Promise<MemberRef[]> {
    // `listOrganizationMembers`, not `findAllUsers`: the latter returns a
    // response envelope meant for a controller, and wrapping it again here
    // is how `data.data` reaches the client.
    return this.userService.listOrganizationMembers(organizationId);
  }

  async inviteMember(
    organizationId: string,
    dto: InviteMemberDto,
  ): Promise<unknown> {
    await this.assertWithinPlanLimit(organizationId, 'users');

    return this.userService.inviteToOrganization(organizationId, dto);
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<unknown> {
    if (dto.role) {
      // The owner-count invariant is UserService's to enforce — it owns the
      // role vocabulary. This service does not compare roles itself.
      await this.userService.assertOrganizationKeepsAnOwner(
        organizationId,
        memberId,
        dto.role,
      );
    }

    return this.userService.updateOrganizationMember(
      organizationId,
      memberId,
      dto,
    );
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actingUserId: string,
  ): Promise<unknown> {
    if (memberId === actingUserId) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        ORGANIZATION_RESPONSE.CANNOT_REMOVE_SELF,
      );
    }

    await this.userService.assertOrganizationKeepsAnOwner(
      organizationId,
      memberId,
    );

    return this.userService.removeFromOrganization(organizationId, memberId);
  }

  // --- Plan limits -------------------------------------------------------

  async getPlanLimits(organizationId: string): Promise<PlanLimits> {
    const organization = await this.findById(organizationId);

    return PLAN_LIMITS[organization.plan];
  }

  /**
   * Enforces a countable plan limit before the thing being counted is created.
   *
   * Checked here rather than in a guard because the guard would need the
   * current count anyway, and two places that both know how to count users is
   * one place too many. CONTEXT.md D12.
   */
  async assertWithinPlanLimit(
    organizationId: string,
    resource: 'users' | 'products' | 'locations',
  ): Promise<void> {
    const limits = await this.getPlanLimits(organizationId);
    const limit = limits[resource];

    if (limit === null) return;

    const current = await this.countForLimit(organizationId, resource);

    if (current < limit) return;

    const message = {
      users: ORGANIZATION_RESPONSE.PLAN_LIMIT_USERS,
      products: ORGANIZATION_RESPONSE.PLAN_LIMIT_PRODUCTS,
      locations: ORGANIZATION_RESPONSE.PLAN_LIMIT_LOCATIONS,
    }[resource];

    return SerializeHttpError(null, HttpStatus.PAYMENT_REQUIRED, message);
  }

  private async countForLimit(
    organizationId: string,
    resource: 'users' | 'products' | 'locations',
  ): Promise<number> {
    if (resource === 'locations') {
      return this.locationModel.countDocuments({
        organization: new Types.ObjectId(organizationId),
        isActive: true,
      });
    }

    if (resource === 'users') {
      return this.userService.countOrganizationMembers(organizationId);
    }

    // Product counts belong to the catalog module, which imports this one —
    // so the check for products is made there, where the model already is.
    return 0;
  }

  /**
   * Whether a plan includes a boolean feature. Read by the modules that own
   * the feature, so a plan change needs no edit here.
   */
  async hasFeature(
    organizationId: string,
    feature: 'whatsapp' | 'aiClerk' | 'automations',
  ): Promise<boolean> {
    const limits = await this.getPlanLimits(organizationId);

    return limits[feature];
  }

  /**
   * Finds the tenant a WhatsApp webhook belongs to.
   *
   * Meta addresses a webhook to a phone number id, not to an organization, so
   * this lookup is what makes a single webhook endpoint safely multi-tenant.
   * Returns null for an unrecognised id — an unknown number is something to
   * ignore quietly, not an error worth alerting on, since anyone can point a
   * webhook at a public URL.
   */
  async findByWhatsAppPhoneNumberId(
    phoneNumberId: string,
  ): Promise<OrganizationDocument | null> {
    return this.organizationModel.findOne({
      'whatsapp.phoneNumberId': phoneNumberId,
    });
  }

  /**
   * The organizations the simulator may target when no phone number id is
   * configured anywhere — which is the normal state before a business
   * connects its own Meta account.
   */
  async findFirstActive(): Promise<OrganizationDocument | null> {
    return this.organizationModel.findOne().sort({ createdAt: 1 });
  }

  async updateWhatsAppSettings(
    organizationId: string,
    settings: {
      connected?: boolean;
      phoneNumberId?: string;
      displayPhoneNumber?: string;
      autoDraftOrders?: boolean;
    },
  ): Promise<OrganizationDocument> {
    const update: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) update[`whatsapp.${key}`] = value;
    }

    const organization = await this.organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    return organization;
  }

  /**
   * Every organization the hourly automation tick must consider.
   *
   * Projected down to only the fields the tick reads. At a thousand tenants
   * this runs every hour, and pulling whole documents — including the
   * WhatsApp token — to read three fields would be wasteful and careless.
   */
  async findAllForAutomation(): Promise<OrganizationDocument[]> {
    return this.organizationModel
      .find({ status: ORGANIZATION_STATUS.ACTIVE })
      .select({ timezone: 1, settings: 1, plan: 1 });
  }

  /**
   * Applies a billing outcome to the tenant.
   *
   * Called only from `BillingService.handleWebhook`, which is the only
   * verified source of truth about what was actually paid for. Every field is
   * optional so a subscription update that carries no plan change can still
   * refresh the renewal date without clearing anything.
   */
  async applyPlan(
    organizationId: string,
    change: {
      plan?: BILLING_PLAN;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      renewsAt?: Date;
    },
  ): Promise<OrganizationDocument> {
    const update: Record<string, unknown> = {};

    if (change.plan) update.plan = change.plan;
    if (change.stripeCustomerId !== undefined) {
      update.stripeCustomerId = change.stripeCustomerId;
    }
    if (change.stripeSubscriptionId !== undefined) {
      update.stripeSubscriptionId = change.stripeSubscriptionId;
    }
    if (change.renewsAt) update.planRenewsAt = change.renewsAt;

    const organization = await this.organizationModel.findByIdAndUpdate(
      organizationId,
      { $set: update },
      { returnDocument: 'after' },
    );

    if (!organization) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        ORGANIZATION_RESPONSE.NOT_FOUND,
      );
    }

    return organization;
  }
}
