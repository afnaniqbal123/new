import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingService } from 'src/modules/billing/billing.service';
import { CreateCheckoutDto } from 'src/modules/billing/dto/billing.dto';
import { BILLING_RESPONSE } from 'src/modules/billing/constants/api-response/billing.response';
import { BILLING_SUBJECT } from 'src/modules/billing/constants/billing.constant';
import { SerializeHttpResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

@Controller('billing')
@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: BILLING_SUBJECT })
  async plans(@GetOrganizationId() organizationId: string) {
    const plans = await this.billingService.getPlans(organizationId);

    return SerializeHttpResponse(plans, 200, BILLING_RESPONSE.PLANS_FETCHED);
  }

  @Get('subscription')
  @TenantScoped()
  @RequirePermissions({ action: Action.Read, subject: BILLING_SUBJECT })
  async subscription(@GetOrganizationId() organizationId: string) {
    const subscription =
      await this.billingService.getSubscription(organizationId);

    return SerializeHttpResponse(
      subscription,
      200,
      BILLING_RESPONSE.SUBSCRIPTION_FETCHED,
    );
  }

  /**
   * Starts Stripe Checkout.
   *
   * Returns a URL for the client to redirect to. The plan does not change
   * here — only the verified webhook does that, because a redirect is not
   * proof of payment.
   */
  @Post('checkout')
  @TenantScoped()
  @RequirePermissions({ action: Action.Create, subject: BILLING_SUBJECT })
  async checkout(
    @GetOrganizationId() organizationId: string,
    @Body() dto: CreateCheckoutDto,
    @GetUser('email') email: string,
  ) {
    const session = await this.billingService.createCheckoutSession(
      organizationId,
      dto.plan,
      email,
    );

    return SerializeHttpResponse(
      session,
      201,
      BILLING_RESPONSE.CHECKOUT_CREATED,
    );
  }

  /** Opens Stripe's billing portal for cards, invoices and cancellation. */
  @Post('portal')
  @TenantScoped()
  @RequirePermissions({ action: Action.Update, subject: BILLING_SUBJECT })
  async portal(@GetOrganizationId() organizationId: string) {
    const session =
      await this.billingService.createPortalSession(organizationId);

    return SerializeHttpResponse(session, 201, BILLING_RESPONSE.PORTAL_CREATED);
  }
}
