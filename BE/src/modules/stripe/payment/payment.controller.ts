import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import Stripe from 'stripe';
import {
  SuccessResponse,
  Serialized,
  SerializeHttpError,
} from 'src/utils/serializer';
import { STRIPE_ERRORS } from 'src/modules/stripe/constants/api-response/stripe.response';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';

/**
 * Payment management controller for Stripe one-time payments.
 * Supports two payment flows:
 * 1. Custom UI with Stripe Elements (Payment Intent)
 * 2. Redirect to Stripe hosted page (Checkout Session)
 *
 * Requires authentication. The DTOs/service still accept an optional
 * `guestEmail` for a guest-checkout code path (useful if you later expose
 * these routes publicly) — this boilerplate's FE has no guest UI, so every
 * request here already carries a real user.
 *
 * IMPORTANT: Implement webhook handler in webhook.service.ts for 'checkout.session.completed'
 * This ensures reliable payment processing even if user closes browser after payment.
 * Webhook is the source of truth; verify-session endpoint is for immediate UX feedback.
 */
@ApiTags('Stripe Payments')
@Controller('stripe/payments')
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create Payment Intent for custom UI flow (Stripe Elements)
   */
  @Post('intent')
  @ApiOperation({
    summary: 'Create a Payment Intent for custom UI flow',
    description: 'Returns client_secret for use with Stripe Elements.',
  })
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<Stripe.PaymentIntent>> {
    if (!userId && !createPaymentIntentDto.guestEmail) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.GUEST_EMAIL_REQUIRED,
      );
    }

    return this.paymentService.createPaymentIntent(
      createPaymentIntentDto,
      userId || undefined,
    );
  }

  /**
   * Retrieve Payment Intent status
   * Used to verify payment after frontend confirmation
   */
  @Get('intent/:id')
  @ApiOperation({ summary: 'Retrieve Payment Intent by ID' })
  @ApiParam({
    name: 'id',
    description: 'Stripe Payment Intent ID',
    example: 'pi_1234567890abcdef',
  })
  async getPaymentIntent(
    @Param('id') paymentIntentId: string,
  ): Promise<
    | Serialized<Stripe.PaymentIntent, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    return this.paymentService.retrievePaymentIntent(paymentIntentId);
  }

  /**
   * Create Checkout Session for redirect flow
   */
  @Post('checkout')
  @ApiOperation({
    summary: 'Create a Checkout Session for redirect flow',
    description: 'Returns session URL to redirect user.',
  })
  async createCheckoutSession(
    @Body() createCheckoutSessionDto: CreateCheckoutSessionDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<Stripe.Checkout.Session>> {
    if (!userId && !createCheckoutSessionDto.guestEmail) {
      throw new BadRequestException('Guest email is required');
    }

    return this.paymentService.createCheckoutSession(
      createCheckoutSessionDto,
      userId || undefined,
    );
  }

  /**
   * Verify Checkout Session after user returns from Stripe
   * Provides immediate UX feedback (webhook handles reliable processing)
   */
  @Get('verify-session/:sessionId')
  @ApiOperation({
    summary: 'Verify Checkout Session after redirect',
    description:
      'Called after user returns from Stripe. Webhook processes payment in background for reliability.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Stripe Checkout Session ID',
    example: 'cs_test_a1234567890abcdef',
  })
  async verifySession(
    @Param('sessionId') sessionId: string,
  ): Promise<
    | Serialized<Stripe.Checkout.Session, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    return this.paymentService.verifyCheckoutSession(sessionId);
  }
}
