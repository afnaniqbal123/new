import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CONFIG } from 'src/constants/config.constant';
import { StripeService } from '../stripe.service';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';
import {
  UserSubscription,
  UserSubscriptionDocument,
} from './schemas/user-subscription.schema';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { CreateSubscriptionIntentDto } from './dto/create-subscription-intent.dto';
import { SubscribeMobileDto } from './dto/subscribe-mobile.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SubscriptionStatusEnum } from './enums/subscription-status.enum';
import { PlanIntervalEnum } from './enums/plan-interval.enum';
import { DEFAULT_PLAN_CURRENCY } from './constants/subscription-plan.constant';
import { UserService } from 'src/modules/user/user.service';
import { CardService } from '../card/card.service';
import Stripe from 'stripe';
import {
  SerializeHttpResponse,
  SerializeHttpError,
  SuccessResponse,
} from 'src/utils/serializer';
import {
  STRIPE_SUCCESS,
  STRIPE_ERRORS,
} from 'src/modules/stripe/constants/api-response/stripe.response';

/**
 * Our billing intervals expressed in Stripe's vocabulary.
 *
 * A map rather than a cast: the compiler requires an entry for every member,
 * so adding an interval to `PlanIntervalEnum` fails here instead of at Stripe.
 */
const STRIPE_RECURRING_INTERVAL: Record<
  PlanIntervalEnum,
  Stripe.PriceCreateParams.Recurring.Interval
> = {
  [PlanIntervalEnum.MONTH]: 'month',
  [PlanIntervalEnum.YEAR]: 'year',
};

/**
 * MongoDB signals a unique-index violation as write error 11000. Mongoose
 * surfaces the driver error unchanged, so the code is the only reliable
 * discriminator — the message text is not stable across server versions.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Subscription service for managing Stripe subscriptions.
 *
 * ARCHITECTURE NOTES:
 * - Direct API operations immediately sync database after Stripe calls
 * - Webhooks act as backup/verification (see webhook.service.ts TODOs)
 * - This ensures data consistency if webhook fails or is delayed
 * - All Stripe changes trigger immediate DB updates for UX responsiveness
 *
 * Webhook handlers (empty by default):
 * - customer.subscription.created: Create user_subscription for Checkout Sessions
 * - customer.subscription.updated: Sync status/plan changes
 * - customer.subscription.deleted: Mark as CANCELED
 * - invoice.payment_succeeded: Confirm subscription activation
 * - invoice.payment_failed: Mark as PAST_DUE
 */
@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(UserSubscription.name)
    private readonly userSubscriptionModel: Model<UserSubscriptionDocument>,
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
    private readonly cardService: CardService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Mobile (stripe-react-native PaymentSheet) flow, step 1: prepare the sheet.
   * Creates/reuses the Stripe customer, an ephemeral key scoped to it, and a
   * SetupIntent (saves a card without charging) for the sheet to confirm.
   * The client then calls `subscribeMobile` with the resulting paymentMethodId.
   */
  async createPaymentSheet(userId: string): Promise<
    SuccessResponse<{
      paymentIntent: string;
      setupIntentId: string;
      ephemeralKey: string;
      customer: string;
      publishableKey: string;
    }>
  > {
    const stripe = this.stripeService.getStripeClient();
    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }

    const user = userResult.data;
    const customer = await this.stripeService.getOrCreateStripeCustomer(user);

    // TODO: Ensure your User entity has a stripeCustomerId field (nullable string)
    if (!user.stripeCustomerId) {
      await this.userService.update(
        userId,
        { stripeCustomerId: customer.id } as any,
        undefined as any,
      );
    }

    const [ephemeralKey, setupIntent] = await Promise.all([
      stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion: '2025-10-29.clover' },
      ),
      stripe.setupIntents.create({ customer: customer.id }),
    ]);

    return SerializeHttpResponse(
      {
        paymentIntent: setupIntent.client_secret as string,
        setupIntentId: setupIntent.id,
        ephemeralKey: ephemeralKey.secret as string,
        customer: customer.id,
        publishableKey:
          this.configService.get<string>(CONFIG.STRIPE_PUBLISHABLE_KEY) ?? '',
      },
      HttpStatus.OK,
      STRIPE_SUCCESS.PAYMENT_INTENT_CREATED,
    );
  }

  /**
   * Mobile flow, step 2: once the sheet has confirmed the SetupIntent (card
   * saved), look up the payment method it attached to the customer and create
   * the actual subscription with it. Delegates to the same logic the
   * custom-UI web flow uses.
   */
  async subscribeMobile(
    userId: string,
    dto: SubscribeMobileDto,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();
    const setupIntent = await stripe.setupIntents.retrieve(dto.setupIntentId);
    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.PAYMENT_METHOD_NOT_FOUND,
      );
    }

    return this.createSubscriptionIntent(userId, {
      priceId: dto.priceId,
      paymentMethodId,
    });
  }

  /**
   * Create subscription using Stripe's hosted Checkout UI
   * Stripe handles card collection and payment method setup
   */
  async createSubscriptionCheckout(
    userId: string,
    dto: CreateSubscriptionCheckoutDto,
  ): Promise<SuccessResponse<Stripe.Checkout.Session>> {
    const stripe = this.stripeService.getStripeClient();
    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;

    // Get/create Stripe customer
    if (!user.stripeCustomerId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.userSubscriptionModel.findOne({
      userId,
      isCurrent: true,
    });

    if (existingSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_ALREADY_EXISTS,
      );
    }

    // Find subscription plan in database
    const plan = await this.subscriptionModel.findOne({
      stripePriceId: dto.priceId,
    });

    if (!plan) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVALID_PLAN,
      );
    }

    // Create Checkout Session for subscription
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: user.stripeCustomerId,
        success_url: dto.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: dto.cancelUrl,
        line_items: [
          {
            price: dto.priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            userId: userId.toString(),
            ...dto.metadata,
          },
        },
        metadata: {
          userId: userId.toString(),
          ...dto.metadata,
        },
      });

      // For Checkout Sessions, subscription is created AFTER payment
      // We can't create user_subscription here yet since session.subscription is null
      // The webhook will create it when checkout.session.completed is received
      // See handleCheckoutSessionCompleted in webhook.service.ts

      return SerializeHttpResponse(
        session,
        HttpStatus.CREATED,
        STRIPE_SUCCESS.SUBSCRIPTION_CREATED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_CREATION_FAILED,
      );
    }
  }

  /**
   * Create subscription using custom UI
   * Requires user to have a payment method already saved
   */
  async createSubscriptionIntent(
    userId: string,
    dto: CreateSubscriptionIntentDto,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();
    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;

    // Validate user has stripeCustomerId
    if (!user.stripeCustomerId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }

    // Check if user already has an active subscription
    const existingSubscription = await this.userSubscriptionModel.findOne({
      userId,
      isCurrent: true,
    });

    if (existingSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_ALREADY_EXISTS,
      );
    }

    // Get or validate payment method
    let paymentMethodId = dto.paymentMethodId;
    if (!paymentMethodId) {
      //We try to get user's default card, if not found, we use the first card
      // Below we are using card module feel free to attach your own card module
      const cardsResponse = await this.cardService.getCards(userId);
      if (!cardsResponse.data || cardsResponse.data.length === 0) {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          STRIPE_ERRORS.PAYMENT_METHOD_REQUIRED,
        );
      }
      const defaultCard = cardsResponse.data.find((card) => card.isDefault);
      paymentMethodId = defaultCard
        ? defaultCard.stripePaymentMethodId
        : cardsResponse.data[0].stripePaymentMethodId;
    }

    // Find subscription plan in database
    const plan = await this.subscriptionModel.findOne({
      stripePriceId: dto.priceId,
    });

    if (!plan) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVALID_PLAN,
      );
    }

    try {
      // Create Stripe subscription
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [
          {
            price: dto.priceId,
          },
        ],
        default_payment_method: paymentMethodId,
        metadata: {
          userId: userId.toString(),
          ...dto.metadata,
        },
      });

      // For Intent flow, subscription is created IMMEDIATELY
      // We can create user_subscription record right away since we have the subscription object
      const userSubscription = new this.userSubscriptionModel({
        userId,
        subscriptionId: plan._id,
        stripeSubscriptionId: subscription.id,
        status: (subscription as any).status as SubscriptionStatusEnum,
        currentPeriodEnd: new Date(
          (subscription as any).current_period_end * 1000,
        ),
        isCurrent: true,
      });
      await userSubscription.save();

      return SerializeHttpResponse(
        subscription,
        HttpStatus.CREATED,
        STRIPE_SUCCESS.SUBSCRIPTION_CREATED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_CREATION_FAILED,
      );
    }
  }

  /**
   * Get user's current active subscription
   */
  async getUserSubscription(
    userId: string,
  ): Promise<SuccessResponse<UserSubscriptionDocument>> {
    const subscription = await this.userSubscriptionModel
      .findOne({ userId, isCurrent: true })
      .populate('subscriptionId')
      .populate('pendingSubscriptionId')
      .exec();

    if (!subscription) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.NO_ACTIVE_SUBSCRIPTION,
      );
    }

    return SerializeHttpResponse(
      subscription,
      HttpStatus.OK,
      STRIPE_SUCCESS.SUBSCRIPTION_RETRIEVED,
    );
  }

  /**
   * Get all subscription history for user
   */
  async getAllSubscriptions(
    userId: string,
  ): Promise<SuccessResponse<UserSubscriptionDocument[]>> {
    const subscriptions = await this.userSubscriptionModel
      .find({ userId })
      .populate('subscriptionId')
      .populate('pendingSubscriptionId')
      .sort({ createdAt: -1 })
      .exec();

    return SerializeHttpResponse(
      subscriptions,
      HttpStatus.OK,
      STRIPE_SUCCESS.SUBSCRIPTIONS_RETRIEVED,
    );
  }

  /**
   * Create a subscription plan.
   *
   * Three things have to exist for a plan to be sellable: a Stripe Product,
   * a recurring Price on it, and the local catalogue row that maps our plan to
   * that price id. `getAvailablePlans` serves the row, and every subscribe
   * flow bills against the price id it carries.
   */
  async createPlan(
    dto: CreatePlanDto,
  ): Promise<SuccessResponse<SubscriptionDocument>> {
    const stripe = this.stripeService.getStripeClient();
    const currency = (dto.currency ?? DEFAULT_PLAN_CURRENCY).toLowerCase();

    // Checked before Stripe is touched. A duplicate discovered after the
    // Product exists leaves a live, unreferenced plan in the Stripe account
    // that nothing here will ever bill against or clean up. The catch below
    // cleans up after the race this read cannot see; this check is what keeps
    // the common case from creating that Product in the first place.
    const existing = await this.subscriptionModel.findOne({ name: dto.name });
    if (existing) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        STRIPE_ERRORS.PLAN_ALREADY_EXISTS,
      );
    }

    // Nothing exists yet, so a failure here needs no cleanup — only an answer
    // in the response envelope rather than a raw Stripe error.
    const product = await stripe.products
      .create({ name: dto.name, description: dto.description })
      .catch(() => null);

    if (!product) {
      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        STRIPE_ERRORS.PLAN_CREATION_FAILED,
      );
    }

    // From here the Product is live in the Stripe account, so every remaining
    // failure has to retire it. A half-created plan is worse than none: it
    // shows up as sellable to whoever reads the dashboard, while no local row
    // points at it and no flow can bill it.
    try {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: dto.amount,
        currency,
        recurring: { interval: STRIPE_RECURRING_INTERVAL[dto.interval] },
      });

      const plan = await this.subscriptionModel.create({
        name: dto.name,
        stripePriceId: price.id,
        description: dto.description,
        amount: dto.amount,
        currency,
        interval: dto.interval,
        features: dto.features,
        isActive: true,
      });

      return SerializeHttpResponse(
        plan,
        HttpStatus.CREATED,
        STRIPE_SUCCESS.PLAN_CREATED,
      );
    } catch (error) {
      // Archiving the Product hides it from the dashboard and from price
      // lookups. Stripe has no delete for a Price, and archiving the parent is
      // the documented way to retire both.
      //
      // Best effort on purpose: if the cleanup also fails, the caller still
      // gets the failure that actually stopped them, not a second error about
      // tidying up.
      await stripe.products
        .update(product.id, { active: false })
        .catch(() => undefined);

      // The read above cannot see a plan another request is inserting right
      // now, so the unique index is what actually rejects the duplicate. That
      // arrives here as a write error, but it is the same outcome the caller
      // was promised for a name already taken — answer it the same way rather
      // than reporting a server fault for what the client got wrong.
      if (isDuplicateKeyError(error)) {
        return SerializeHttpError(
          null,
          HttpStatus.CONFLICT,
          STRIPE_ERRORS.PLAN_ALREADY_EXISTS,
        );
      }

      return SerializeHttpError(
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
        STRIPE_ERRORS.PLAN_CREATION_FAILED,
      );
    }
  }

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SuccessResponse<SubscriptionDocument[]>> {
    const plans = await this.subscriptionModel
      .find({ isActive: true })
      .sort({ amount: 1 })
      .exec();

    return SerializeHttpResponse(
      plans,
      HttpStatus.OK,
      STRIPE_SUCCESS.PLANS_RETRIEVED,
    );
  }

  /**
   * Upgrade subscription immediately with proration
   */
  async upgradeSubscription(
    userId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();

    // Get current active subscription
    const userSubscription = await this.userSubscriptionModel
      .findOne({ userId, isCurrent: true })
      .populate('subscriptionId')
      .exec();

    if (!userSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.NO_ACTIVE_SUBSCRIPTION,
      );
    }

    // Find new subscription plan
    const newPlan = await this.subscriptionModel.findOne({
      stripePriceId: dto.newPriceId,
    });

    if (!newPlan) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVALID_PLAN,
      );
    }

    // Check if downgrading to same plan
    if (
      (userSubscription.subscriptionId as any).toString() ===
      (newPlan._id as any).toString()
    ) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CANNOT_DOWNGRADE_TO_SAME_PLAN,
      );
    }

    try {
      // Get current subscription from Stripe
      const currentSub = await stripe.subscriptions.retrieve(
        userSubscription.stripeSubscriptionId,
      );

      // Update subscription immediately with proration
      const updatedSub = await stripe.subscriptions.update(
        userSubscription.stripeSubscriptionId,
        {
          items: [
            {
              id: (currentSub as any).items.data[0].id,
              price: dto.newPriceId,
            },
          ],
          proration_behavior: 'create_prorations', // Immediate charge/credit
        },
      );

      // Update user subscription record
      userSubscription.subscriptionId = newPlan._id;
      userSubscription.status = (updatedSub as any)
        .status as SubscriptionStatusEnum;
      userSubscription.currentPeriodEnd = new Date(
        (updatedSub as any).current_period_end * 1000,
      );
      await userSubscription.save();

      return SerializeHttpResponse(
        updatedSub,
        HttpStatus.OK,
        STRIPE_SUCCESS.SUBSCRIPTION_UPGRADED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_UPDATE_FAILED,
      );
    }
  }

  /**
   * Downgrade subscription - effective from next billing cycle
   */
  async downgradeSubscription(
    userId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();

    // Get current active subscription
    const userSubscription = await this.userSubscriptionModel
      .findOne({ userId, isCurrent: true })
      .populate('subscriptionId')
      .exec();

    if (!userSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.NO_ACTIVE_SUBSCRIPTION,
      );
    }

    // Find new subscription plan
    const newPlan = await this.subscriptionModel.findOne({
      stripePriceId: dto.newPriceId,
    });

    if (!newPlan) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVALID_PLAN,
      );
    }

    // Check if downgrading to same plan
    if (
      (userSubscription.subscriptionId as any).toString() ===
      (newPlan._id as any).toString()
    ) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CANNOT_DOWNGRADE_TO_SAME_PLAN,
      );
    }

    try {
      // Get current subscription from Stripe
      const currentSub = await stripe.subscriptions.retrieve(
        userSubscription.stripeSubscriptionId,
      );

      // Update subscription with scheduled change using Subscription Schedule
      const schedule = await stripe.subscriptionSchedules.create({
        customer: (currentSub as any).customer as string,
        start_date: (currentSub as any).current_period_end,
        end_behavior: 'release',
        phases: [
          {
            // Current phase continues until period end
            items: [
              {
                price: (currentSub as any).items.data[0].price.id,
                quantity: 1,
              },
            ],
          },
          {
            // New phase starts after period end
            items: [
              {
                price: dto.newPriceId,
                quantity: 1,
              },
            ],
          },
        ],
      });

      // Update user subscription record with pending subscription
      userSubscription.pendingSubscriptionId = newPlan._id;
      userSubscription.scheduledChangeAt = new Date(
        (currentSub as any).current_period_end * 1000,
      );
      userSubscription.stripeSubscriptionScheduleId = schedule.id;
      await userSubscription.save();

      return SerializeHttpResponse(
        currentSub,
        HttpStatus.OK,
        STRIPE_SUCCESS.SUBSCRIPTION_DOWNGRADED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_UPDATE_FAILED,
      );
    }
  }

  /**
   * Cancel subscription - effective from next billing cycle by default
   */
  async cancelSubscription(
    userId: string,
    dto: CancelSubscriptionDto,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();

    // Get current active subscription
    const userSubscription = await this.userSubscriptionModel.findOne({
      userId,
      isCurrent: true,
    });

    if (!userSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.NO_ACTIVE_SUBSCRIPTION,
      );
    }

    try {
      const cancelAtPeriodEnd = dto.cancelAtPeriodEnd ?? true;

      if (cancelAtPeriodEnd) {
        // Cancel at period end (default behavior)
        const updatedSub = await stripe.subscriptions.update(
          userSubscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          },
        );

        userSubscription.canceledAt = new Date();
        userSubscription.status = (updatedSub as any)
          .status as SubscriptionStatusEnum;
        await userSubscription.save();

        return SerializeHttpResponse(
          updatedSub,
          HttpStatus.OK,
          STRIPE_SUCCESS.SUBSCRIPTION_CANCELED,
        );
      } else {
        // Cancel immediately
        const canceledSub = await stripe.subscriptions.cancel(
          userSubscription.stripeSubscriptionId,
        );

        userSubscription.status = SubscriptionStatusEnum.CANCELED;
        userSubscription.isCurrent = false;
        userSubscription.canceledAt = new Date();
        await userSubscription.save();

        return SerializeHttpResponse(
          canceledSub,
          HttpStatus.OK,
          STRIPE_SUCCESS.SUBSCRIPTION_CANCELED,
        );
      }
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_CANCEL_FAILED,
      );
    }
  }

  /**
   * Resume a cancelled subscription
   */
  async resumeSubscription(
    userId: string,
  ): Promise<SuccessResponse<Stripe.Subscription>> {
    const stripe = this.stripeService.getStripeClient();

    // Get current subscription
    const userSubscription = await this.userSubscriptionModel.findOne({
      userId,
      isCurrent: true,
    });

    if (!userSubscription) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.NO_ACTIVE_SUBSCRIPTION,
      );
    }

    if (!userSubscription.canceledAt) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        'Subscription is not cancelled',
      );
    }

    try {
      const updatedSub = await stripe.subscriptions.update(
        userSubscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        },
      );

      userSubscription.canceledAt = undefined;
      userSubscription.resumesAt = new Date();
      userSubscription.status = (updatedSub as any)
        .status as SubscriptionStatusEnum;
      await userSubscription.save();

      return SerializeHttpResponse(
        updatedSub,
        HttpStatus.OK,
        STRIPE_SUCCESS.SUBSCRIPTION_RESUMED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SUBSCRIPTION_UPDATE_FAILED,
      );
    }
  }

  /**
   * Verify checkout session after redirect from Stripe
   */
  async verifyCheckoutSession(
    sessionId: string,
  ): Promise<SuccessResponse<Stripe.Checkout.Session>> {
    const stripe = this.stripeService.getStripeClient();

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (
        session.payment_status === 'paid' &&
        session.mode === 'subscription'
      ) {
        return SerializeHttpResponse(
          session,
          HttpStatus.OK,
          STRIPE_SUCCESS.SESSION_VERIFIED,
        );
      }

      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SESSION_NOT_FOUND,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SESSION_NOT_FOUND,
      );
    }
  }
}
