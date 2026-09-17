import { Injectable, BadRequestException, HttpStatus } from '@nestjs/common';
import { StripeService } from '../stripe.service';
import { UserService } from 'src/modules/user/user.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
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
export class InvoiceService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
  ) {}

  async createInvoice(
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<SuccessResponse<Stripe.Invoice>> {
    const stripe = this.stripeService.getStripeClient();

    const userResult = await this.userService.findOne(
      createInvoiceDto.customerId,
    );
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;

    if (!user.stripeCustomerId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }

    // Step 1: Create invoice first (empty, draft status)
    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: user.stripeCustomerId,
      auto_advance: false,
    };

    if (createInvoiceDto.metadata) {
      invoiceParams.metadata = createInvoiceDto.metadata;
    }

    const invoice = await stripe.invoices.create(invoiceParams);

    // Step 2: Create invoice item and attach it to the invoice
    const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
      customer: user.stripeCustomerId,
      invoice: invoice.id,
      amount: createInvoiceDto.amount,
      currency: createInvoiceDto.currency.toLowerCase(),
      description: createInvoiceDto.description,
    };

    if (createInvoiceDto.metadata) {
      invoiceItemParams.metadata = createInvoiceDto.metadata;
    }

    await stripe.invoiceItems.create(invoiceItemParams);

    try {
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
      );
    } catch (error: any) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVOICE_FINALIZATION_FAILED,
      );
    }

    const invoiceWithLines = await stripe.invoices.retrieve(invoice.id, {
      expand: ['lines'],
    });

    return SerializeHttpResponse(
      invoiceWithLines,
      HttpStatus.CREATED,
      STRIPE_SUCCESS.INVOICE_CREATED,
    );
  }

  async getInvoiceById(
    invoiceId: string,
  ): Promise<
    | Serialized<Stripe.Invoice, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    const stripe = this.stripeService.getStripeClient();

    try {
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['lines'],
      });

      return SerializeHttpResponse(
        invoice,
        HttpStatus.OK,
        STRIPE_SUCCESS.INVOICE_RETRIEVED,
      );
    } catch (error: any) {
      return SerializeHttpResponse(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVOICE_NOT_FOUND,
      );
    }
  }

  async payInvoiceManually(
    invoiceId: string,
    payWithCard: boolean,
  ): Promise<
    | Serialized<Stripe.Invoice, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    const stripe = this.stripeService.getStripeClient();

    // 1️⃣ Retrieve the invoice
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (invoice.status !== 'open') {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVOICE_NOT_FINALIZED,
      );
    }

    let paidInvoice: Stripe.Invoice;

    try {
      if (payWithCard) {
        // Try to auto-charge the customer’s saved payment method
        paidInvoice = await stripe.invoices.pay(invoiceId);
      } else {
        // Mark invoice as paid manually (offline)
        paidInvoice = await stripe.invoices.pay(invoiceId, {
          paid_out_of_band: true,
        });
      }
    } catch (error) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.INVOICE_PAYMENT_FAILED,
      );
    }

    // 3️⃣ Return success
    return SerializeHttpResponse(
      paidInvoice,
      HttpStatus.OK,
      payWithCard
        ? STRIPE_SUCCESS.INVOICE_PAID
        : 'Invoice marked as paid manually (offline payment).',
    );
  }
}
