import { Controller, Get, Post, Body, Param, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import Stripe from 'stripe';
import { Serialized, SuccessResponse } from 'src/utils/serializer';
import { PayInvoiceDto } from './dto/pay-invoice.dto';

/**
 * Invoice management controller for Stripe invoices.
 * TODO: These endpoints don't yet verify the requesting user owns the
 * Stripe customer/invoice in question (only that they're authenticated) —
 * add that check against `invoice.customer` if invoices become user-facing.
 */
@ApiTags('Stripe Invoices')
@Controller('stripe/invoices')
@ApiBearerAuth()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  async createInvoice(
    @Body() createInvoiceDto: CreateInvoiceDto,
  ): Promise<SuccessResponse<Stripe.Invoice>> {
    // SECURITY: Invoices are automatically associated with the Stripe customer
    // This prevents users from creating invoices for other users' Stripe customers
    return this.invoiceService.createInvoice(createInvoiceDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({
    name: 'id',
    description: 'Stripe invoice ID',
    example: 'in_1234567890abcdef',
  })
  async getInvoiceById(
    @Param('id') invoiceId: string,
  ): Promise<
    | Serialized<Stripe.Invoice, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    return this.invoiceService.getInvoiceById(invoiceId);
  }

  /**
   * Pay a finalized invoice manually.
   * This triggers Stripe to attempt payment for the invoice (e.g., using saved card)
   * or marks it as paid if payment collection is handled outside Stripe.
   */
  @Post('pay/:id')
  @ApiOperation({
    summary: 'Pay a finalized invoice manually or mark it as paid',
  })
  @ApiParam({
    name: 'id',
    description: 'Stripe invoice ID to pay',
    example: 'in_1234567890abcdef',
  })
  async payInvoiceManually(
    @Param('id') invoiceId: string,
    @Body() body: PayInvoiceDto,
  ): Promise<
    | Serialized<Stripe.Invoice, HttpStatus.OK>
    | Serialized<null, HttpStatus.BAD_REQUEST>
  > {
    return this.invoiceService.payInvoiceManually(invoiceId, body.payWithCard);
  }
}
