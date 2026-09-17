import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiForbiddenResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { CreateSubscriptionIntentDto } from './dto/create-subscription-intent.dto';
import { SubscribeMobileDto } from './dto/subscribe-mobile.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SubscriptionDocument } from './schemas/subscription.schema';
import Stripe from 'stripe';
import { SuccessResponse } from 'src/utils/serializer';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { SUBSCRIPTION_PLAN_SUBJECT } from './constants/subscription-plan-subject.constant';

/**
 * Subscription management controller for Stripe subscriptions.
 * Supports two subscription creation flows:
 * 1. Hosted UI (Checkout Sessions) - Stripe handles card collection
 * 2. Custom UI (Payment Intents) - Uses existing saved cards
 */
@ApiTags('Stripe Subscriptions')
@Controller('stripe/subscriptions')
@ApiBearerAuth()
// Every route below is already authenticated by the global JwtAccessGuard.
// This adds the permission check, which only the routes carrying
// @RequirePermissions() actually consume — the guard stands aside on the rest.
@UseGuards(PermissionsGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Mobile (stripe-react-native PaymentSheet) flow, step 1
   */
  @Post('payment-sheet')
  @ApiOperation({
    summary: 'Prepare a Stripe PaymentSheet for the mobile client',
    description:
      'Returns { paymentIntent, ephemeralKey, customer, publishableKey } for stripe-react-native initPaymentSheet().',
  })
  async createPaymentSheet(@GetUser('id') userId: string) {
    return this.subscriptionService.createPaymentSheet(userId);
  }

  /**
   * Mobile flow, step 2 — create the subscription with the sheet's payment method
   */
  @Post('subscribe-mobile')
  @ApiOperation({
    summary: 'Create a subscription from the mobile PaymentSheet flow',
    description:
      'Call after the PaymentSheet has confirmed, with the resulting paymentMethodId.',
  })
  async subscribeMobile(
    @Body() dto: SubscribeMobileDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    return this.subscriptionService.subscribeMobile(userId, dto);
  }

  /**
   * Create subscription using Stripe's hosted Checkout UI
   * Stripe handles card collection and payment method setup
   */
  @Post('checkout')
  @ApiOperation({
    summary: 'Create subscription using Stripe hosted Checkout UI',
    description:
      'Returns Checkout session URL to redirect user. Stripe handles card collection.',
  })
  async createSubscriptionCheckout(
    @Body() createSubscriptionCheckoutDto: CreateSubscriptionCheckoutDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<Stripe.Checkout.Session>> {
    // SECURITY: Subscriptions are automatically associated with the authenticated user
    // This prevents users from creating subscriptions for other users
    return this.subscriptionService.createSubscriptionCheckout(
      userId,
      createSubscriptionCheckoutDto,
    );
  }

  /**
   * Create subscription using custom UI
   * Requires user to have a payment method already saved
   */
  @Post('intent')
  @ApiOperation({
    summary: 'Create subscription using custom UI',
    description:
      'Requires user to have a saved card. Returns subscription object.',
  })
  async createSubscriptionIntent(
    @Body() createSubscriptionIntentDto: CreateSubscriptionIntentDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    // SECURITY: Subscriptions are automatically associated with the authenticated user
    // This prevents users from creating subscriptions for other users
    return this.subscriptionService.createSubscriptionIntent(
      userId,
      createSubscriptionIntentDto,
    );
  }

  /**
   * Get user's current active subscription
   */
  @Get()
  @ApiOperation({ summary: 'Get current active subscription' })
  async getUserSubscription(@GetUser('id') userId: string) {
    // SECURITY: Only returns subscription belonging to the authenticated user
    return this.subscriptionService.getUserSubscription(userId);
  }

  /**
   * Get all subscription history for user
   */
  @Get('history')
  @ApiOperation({ summary: 'Get all subscription history for user' })
  async getAllSubscriptions(@GetUser('id') userId: string) {
    // SECURITY: Only returns subscriptions belonging to the authenticated user
    return this.subscriptionService.getAllSubscriptions(userId);
  }

  /**
   * Get all available subscription plans
   */
  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  async getAvailablePlans() {
    return this.subscriptionService.getAvailablePlans();
  }

  /**
   * Create a subscription plan (operators only)
   */
  @Post('plans')
  @ApiOperation({
    summary: 'Create a subscription plan',
    description:
      "Creates the Stripe Product and recurring Price, then stores the plan so GET /plans serves it. Amount is in the currency's smallest unit.",
  })
  @ApiForbiddenResponse({
    description: 'Caller may not change the plan catalogue',
  })
  @ApiConflictResponse({ description: 'A plan with this name already exists' })
  @RequirePermissions({
    action: Action.Create,
    subject: SUBSCRIPTION_PLAN_SUBJECT,
  })
  async createPlan(
    @Body() createPlanDto: CreatePlanDto,
  ): Promise<SuccessResponse<SubscriptionDocument>> {
    // SECURITY: PermissionsGuard has already established that this caller may
    // create plans. The policy uses no record conditions, so there is nothing
    // further to assert once the record exists.
    return this.subscriptionService.createPlan(createPlanDto);
  }

  /**
   * Upgrade subscription immediately with proration
   */
  @Patch('upgrade')
  @ApiOperation({
    summary: 'Upgrade subscription immediately',
    description:
      'Changes take effect immediately with prorated charges/credits',
  })
  async upgradeSubscription(
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @GetUser('id') userId: string,
  ) {
    // SECURITY: Users can only upgrade their own subscriptions
    return this.subscriptionService.upgradeSubscription(
      userId,
      updateSubscriptionDto,
    );
  }

  /**
   * Downgrade subscription - effective from next billing cycle
   */
  @Patch('downgrade')
  @ApiOperation({
    summary: 'Downgrade subscription',
    description:
      'Changes take effect from the next billing cycle (no immediate charge)',
  })
  async downgradeSubscription(
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @GetUser('id') userId: string,
  ) {
    // SECURITY: Users can only downgrade their own subscriptions
    return this.subscriptionService.downgradeSubscription(
      userId,
      updateSubscriptionDto,
    );
  }

  /**
   * Cancel subscription
   */
  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel subscription',
    description:
      'Cancels at period end by default. Set cancelAtPeriodEnd=false for immediate cancellation',
  })
  async cancelSubscription(
    @Body() cancelSubscriptionDto: CancelSubscriptionDto,
    @GetUser('id') userId: string,
  ) {
    // SECURITY: Users can only cancel their own subscriptions
    return this.subscriptionService.cancelSubscription(
      userId,
      cancelSubscriptionDto,
    );
  }

  /**
   * Resume cancelled subscription
   */
  @Post('resume')
  @ApiOperation({
    summary: 'Resume cancelled subscription',
    description:
      'Undoes a cancellation before the period ends. Subscription continues normally.',
  })
  async resumeSubscription(@GetUser('id') userId: string) {
    // SECURITY: Users can only resume their own subscriptions
    return this.subscriptionService.resumeSubscription(userId);
  }

  /**
   * Verify checkout session after redirect from Stripe
   */
  @Get('verify/:sessionId')
  @ApiOperation({
    summary: 'Verify checkout session after redirect',
    description:
      'Called after user returns from Stripe. Webhook handles reliable processing in background.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Stripe Checkout Session ID',
    example: 'cs_test_a1234567890abcdef',
  })
  async verifySession(@Param('sessionId') sessionId: string) {
    return this.subscriptionService.verifyCheckoutSession(sessionId);
  }
}
