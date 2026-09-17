import { Injectable, BadRequestException, HttpStatus } from '@nestjs/common';
import { StripeService } from '../stripe.service';
import { UserService } from 'src/modules/user/user.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import Stripe from 'stripe';
import {
  SerializeHttpResponse,
  SerializeHttpError,
  SuccessResponse,
  Serialized,
} from 'src/utils/serializer';
import {
  STRIPE_SUCCESS,
  STRIPE_ERRORS,
} from 'src/modules/stripe/constants/api-response/stripe.response';

@Injectable()
export class PaymentService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
  ) {}

  /**
   * Create a Payment Intent for custom UI flow (Stripe Elements)
   * Supports both authenticated users and guest payments
   */
  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
    userId?: string,
  ): Promise<SuccessResponse<Stripe.PaymentIntent>> {
    const stripe = this.stripeService.getStripeClient();

    // Build payment intent parameters
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: dto.amount,
      currency: dto.currency.toLowerCase(),
      description: dto.description,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    if (userId) {
      const userResult = await this.userService.findOne(userId);
      if (
        !userResult ||
        !userResult.data ||
        !userResult.data.stripeCustomerId
      ) {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
        );
      }
      paymentIntentParams.customer = userResult.data.stripeCustomerId;
    } else if (dto.guestEmail) {
      paymentIntentParams.receipt_email = dto.guestEmail;
    }
    // Add metadata if provided
    if (dto.metadata) {
      paymentIntentParams.metadata = dto.metadata;
    }
    try {
      const paymentIntent =
        await stripe.paymentIntents.create(paymentIntentParams);
      return SerializeHttpResponse(
        paymentIntent,
        HttpStatus.CREATED,
        STRIPE_SUCCESS.PAYMENT_INTENT_CREATED,
      );
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.PAYMENT_INTENT_CREATION_FAILED,
      );
    }
  }

  /**
   * Create a Checkout Session for redirect flow
   * Supports both authenticated users and guest payments
   */
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    userId?: string,
  ): Promise<SuccessResponse<Stripe.Checkout.Session>> {
    const stripe = this.stripeService.getStripeClient();

    try {
      // Build checkout session parameters
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'payment', // One-time payment
        success_url: dto.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: dto.cancelUrl,
        line_items: [
          {
            price_data: {
              currency: dto.currency.toLowerCase(),
              product_data: {
                name: dto.description,
              },
              unit_amount: dto.amount,
            },
            quantity: 1,
          },
        ],
      };

      // Handle authenticated user
      if (userId) {
        const userResult = await this.userService.findOne(userId);
        if (!userResult || !userResult.data) {
          return SerializeHttpError(
            null,
            HttpStatus.NOT_FOUND,
            STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
          );
        }
        const user = userResult.data;

        // Create or get Stripe customer
        if (!user.stripeCustomerId) {
          return SerializeHttpError(
            null,
            HttpStatus.BAD_REQUEST,
            STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
          );
        }

        sessionParams.customer = user.stripeCustomerId;
      } else if (dto.guestEmail) {
        // Handle guest payment with email
        sessionParams.customer_email = dto.guestEmail;
      }

      // Add metadata if provided
      if (dto.metadata) {
        sessionParams.metadata = dto.metadata;
      }

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create(sessionParams);

      return SerializeHttpResponse(
        session,
        HttpStatus.CREATED,
        STRIPE_SUCCESS.CHECKOUT_SESSION_CREATED,
      );
    } catch (error: any) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CHECKOUT_SESSION_CREATION_FAILED,
      );
    }
  }

  /**
   * Retrieve Payment Intent details
   */
  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<
    | Serialized<Stripe.PaymentIntent, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    const stripe = this.stripeService.getStripeClient();

    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      return SerializeHttpResponse(
        paymentIntent,
        HttpStatus.OK,
        STRIPE_SUCCESS.PAYMENT_INTENT_RETRIEVED,
      );
    } catch (error: any) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.PAYMENT_INTENT_NOT_FOUND,
      );
    }
  }

  /**
   * Verify Checkout Session after user returns from Stripe
   * Provides immediate UX feedback (webhook handles reliable processing)
   */
  async verifyCheckoutSession(
    sessionId: string,
  ): Promise<
    | Serialized<Stripe.Checkout.Session, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    const stripe = this.stripeService.getStripeClient();

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      // Check if payment was successful
      if (session.payment_status === 'paid') {
        return SerializeHttpResponse(
          session,
          HttpStatus.OK,
          STRIPE_SUCCESS.SESSION_VERIFIED,
        );
      }

      // If not paid, return error
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SESSION_NOT_FOUND,
      );
    } catch (error: any) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.SESSION_NOT_FOUND,
      );
    }
  }
}
