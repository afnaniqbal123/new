import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DraftOrder,
  DraftOrderDocument,
} from 'src/modules/whatsapp/draft-order.schema';
import {
  Conversation,
  ConversationDocument,
} from 'src/modules/whatsapp/conversation.schema';
import {
  CONVERSATION_STATUS,
  DRAFT_ORDER_STATUS,
} from 'src/modules/whatsapp/constants/whatsapp.constant';
import { WHATSAPP_RESPONSE } from 'src/modules/whatsapp/constants/api-response/whatsapp.response';
import { ConfirmDraftOrderDto } from 'src/modules/whatsapp/dto/whatsapp.dto';
import { SerializeHttpError } from 'src/utils/serializer';
import { SaleOverrides, SalesService } from 'src/modules/sales/sales.service';
import { SALE_SOURCE } from 'src/modules/sales/constants/sales.constant';
import { SaleRef } from 'src/modules/sales/types/sale-view.type';

/**
 * Turns an AI proposal into a real sale — under human control.
 *
 * This service is the enforcement point for CONTEXT.md D9. A `DraftOrder`
 * carries no prices and no totals; confirming one hands its lines to
 * `SalesService.create`, which prices, taxes, credit-checks and stock-checks
 * them exactly as it would for a sale rung up at the counter.
 *
 * There is deliberately **no** fast path that skips that. A WhatsApp order
 * and a counter sale go through the same code, so a customer cannot be
 * charged differently depending on which door they came through.
 */
@Injectable()
export class DraftOrderService {
  constructor(
    @InjectModel(DraftOrder.name)
    private readonly draftModel: Model<DraftOrderDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly salesService: SalesService,
  ) {}

  async findAll(
    organizationId: string,
    status?: DRAFT_ORDER_STATUS,
  ): Promise<DraftOrderDocument[]> {
    return this.draftModel
      .find({
        organization: new Types.ObjectId(organizationId),
        ...(status ? { status } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('customer', 'name businessName phone outstanding creditLimit')
      .populate('lines.product', 'name sku sellingPrice stockOnHand unit');
  }

  async findById(
    organizationId: string,
    draftId: string,
  ): Promise<DraftOrderDocument> {
    const draft = await this.draftModel
      .findOne({
        _id: new Types.ObjectId(draftId),
        organization: new Types.ObjectId(organizationId),
      })
      .populate('customer', 'name businessName phone outstanding creditLimit')
      .populate('lines.product', 'name sku sellingPrice stockOnHand unit')
      .populate('lines.alternatives', 'name sku sellingPrice');

    if (!draft) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        WHATSAPP_RESPONSE.DRAFT_NOT_FOUND,
      );
    }

    return draft;
  }

  /**
   * Confirms a draft, creating a real sale.
   *
   * The caller may correct lines on the way through — changing a product the
   * matcher got wrong, adjusting a quantity, or dropping a line entirely.
   * Those corrections are the point of the confirm screen; a draft that could
   * only be accepted or rejected wholesale would be rejected constantly.
   */
  async confirm(
    organizationId: string,
    draftId: string,
    dto: ConfirmDraftOrderDto,
    userId: string,
    overrides: SaleOverrides,
  ): Promise<{ draft: DraftOrderDocument; sale: SaleRef }> {
    const draft = await this.findById(organizationId, draftId);

    if (draft.status !== DRAFT_ORDER_STATUS.PENDING) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        WHATSAPP_RESPONSE.DRAFT_NOT_PENDING,
      );
    }

    // Corrected lines from the confirm screen replace the AI's, when sent.
    // Falling back to the draft's own lines means a draft the matcher got
    // entirely right can be confirmed with one tap and no payload.
    const lines = dto.lines?.length
      ? dto.lines.map((line) => ({
          product: line.product,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }))
      : draft.lines
          .filter((line) => line.product)
          .map((line) => ({
            product: String(line.product._id ?? line.product),
            quantity: line.quantity,
            unitPrice: undefined,
          }));

    if (lines.length === 0) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        WHATSAPP_RESPONSE.DRAFT_HAS_UNMATCHED_LINES,
      );
    }

    const customerId =
      dto.customer ??
      (draft.customer
        ? String(draft.customer._id ?? draft.customer)
        : undefined);

    // A WhatsApp order is by definition not a walk-in, so it needs a customer
    // — there has to be someone to invoice and, if it goes on credit, to owe.
    if (!customerId) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        WHATSAPP_RESPONSE.DRAFT_NEEDS_CUSTOMER,
      );
    }

    // The same call the POS makes. Pricing, tax, credit limit, stock — all of
    // it happens here, deterministically, and any of it can still refuse.
    const sale = await this.salesService.create(
      organizationId,
      {
        customer: customerId,
        location: dto.location,
        lines,
        payments: dto.payments,
        note: dto.note,
        conversation: String(draft.conversation),
      },
      userId,
      overrides,
      SALE_SOURCE.WHATSAPP,
    );

    draft.status = DRAFT_ORDER_STATUS.CONFIRMED;
    draft.sale = sale._id;
    draft.actionedBy = new Types.ObjectId(userId);
    draft.actionedAt = new Date();
    await draft.save();

    await this.clearConversationPending(draft);

    return { draft, sale };
  }

  async reject(
    organizationId: string,
    draftId: string,
    userId: string,
    reason?: string,
  ): Promise<DraftOrderDocument> {
    const draft = await this.findById(organizationId, draftId);

    if (draft.status !== DRAFT_ORDER_STATUS.PENDING) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        WHATSAPP_RESPONSE.DRAFT_NOT_PENDING,
      );
    }

    draft.status = DRAFT_ORDER_STATUS.REJECTED;
    draft.rejectionReason = reason ?? '';
    draft.actionedBy = new Types.ObjectId(userId);
    draft.actionedAt = new Date();
    await draft.save();

    await this.clearConversationPending(draft);

    return draft;
  }

  private async clearConversationPending(
    draft: DraftOrderDocument,
  ): Promise<void> {
    await this.conversationModel.updateOne(
      { _id: draft.conversation },
      {
        $set: { status: CONVERSATION_STATUS.OPEN },
        $unset: { pendingDraft: '' },
      },
    );
  }

  /** Pending draft count, for the navigation badge. */
  async countPending(organizationId: string): Promise<number> {
    return this.draftModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      status: DRAFT_ORDER_STATUS.PENDING,
    });
  }
}
