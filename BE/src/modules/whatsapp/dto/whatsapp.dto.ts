import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import {
  CONVERSATION_STATUS,
  DRAFT_ORDER_STATUS,
} from 'src/modules/whatsapp/constants/whatsapp.constant';
import { SalePaymentDto } from 'src/modules/sales/dto/sales.dto';

export class SendWhatsAppMessageDto {
  @ApiProperty({ example: 'Your order is ready for pickup.' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 4000)
  text: string;
}

export class LinkCustomerDto {
  @ApiProperty({ description: 'Customer id' })
  @IsMongoId()
  customer: string;
}

export class ConversationQueryDto {
  @ApiProperty({ required: false, enum: CONVERSATION_STATUS })
  @IsOptional()
  @IsEnum(CONVERSATION_STATUS)
  status?: CONVERSATION_STATUS;
}

export class DraftOrderQueryDto {
  @ApiProperty({ required: false, enum: DRAFT_ORDER_STATUS })
  @IsOptional()
  @IsEnum(DRAFT_ORDER_STATUS)
  status?: DRAFT_ORDER_STATUS;
}

export class ConfirmDraftLineDto {
  @ApiProperty({ description: 'Product id — corrected if the match was wrong' })
  @IsMongoId()
  product: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ required: false, description: 'Minor units' })
  @IsOptional()
  @IsInt()
  unitPrice?: number;
}

/**
 * Confirming a draft.
 *
 * Every field is optional because a draft the matcher got right should be
 * confirmable with an empty body — one tap. The fields exist for the case
 * where a human is correcting something, which is the whole reason a person
 * is in this loop at all.
 */
export class ConfirmDraftOrderDto {
  @ApiProperty({
    required: false,
    type: [ConfirmDraftLineDto],
    description: 'Corrected lines. Omit to accept the draft as-is.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmDraftLineDto)
  lines?: ConfirmDraftLineDto[];

  @ApiProperty({
    required: false,
    description:
      'Required if the conversation is not yet linked to a customer.',
  })
  @IsOptional()
  @IsMongoId()
  customer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  location?: string;

  @ApiProperty({ required: false, type: [SalePaymentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments?: SalePaymentDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectDraftOrderDto {
  @ApiProperty({ required: false, example: 'Customer changed their mind' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

/**
 * Injects an inbound message as though it had arrived from Meta.
 *
 * The mechanism that makes the entire WhatsApp feature developable, testable
 * and demonstrable without a Meta Business account. It goes through exactly
 * the same `handleInbound` path a real webhook does — the only difference is
 * that the message is flagged `simulated` so it is never mistaken for real
 * traffic in reporting. CONTEXT.md D10.
 */
export class SimulateInboundDto {
  @ApiProperty({ example: '+92 300 1234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Need 20 boxes of A4 paper and 10 blue pens' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  text: string;

  @ApiProperty({ required: false, example: 'Ahmed Raza' })
  @IsOptional()
  @IsString()
  contactName?: string;
}
