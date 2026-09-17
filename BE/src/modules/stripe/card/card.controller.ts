import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CardService } from './card.service';
import { AddCardDto } from './dto/add-card.dto';
import { SetDefaultCardDto } from './dto/set-default-card.dto';
import { CardDocument } from './schemas/card.schema';
import { SerializeHttpResponse, SuccessResponse } from 'src/utils/serializer';
import { STRIPE_SUCCESS } from 'src/modules/stripe/constants/api-response/stripe.response';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';

/**
 * Card management controller for Stripe payment methods.
 */
@ApiTags('Stripe Cards')
@Controller('stripe/cards')
@ApiBearerAuth()
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new card for the current user' })
  async addCard(
    @Body() addCardDto: AddCardDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<CardDocument>> {
    // SECURITY: Cards are automatically associated with the authenticated user
    // This prevents users from adding cards to other users' accounts
    return this.cardService.addCard(userId, addCardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get cards for current user' })
  async getCards(
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<CardDocument[]>> {
    // SECURITY: Only returns cards belonging to the authenticated user
    // This prevents users from accessing other users' card information
    return this.cardService.getCards(userId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all cards for all users (admin only)' })
  async getAllCards(): Promise<SuccessResponse<CardDocument[]>> {
    return this.cardService.getAllCards();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a card' })
  async deleteCard(@Param('id') cardId: string, @GetUser('id') userId: string) {
    // SECURITY: Validate that the user can only delete their own cards
    // This prevents users from deleting other users' cards
    await this.cardService.deleteCard(userId, cardId);
    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      STRIPE_SUCCESS.CARD_DELETED,
    );
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a card as default' })
  async setDefaultCard(
    @Param('id') cardId: string,
    @Body() setDefaultCardDto: SetDefaultCardDto,
    @GetUser('id') userId: string,
  ): Promise<SuccessResponse<CardDocument>> {
    // SECURITY: Validate that the user can only set their own cards as default
    // This prevents users from setting other users' cards as their default
    return this.cardService.setDefaultCard(userId, cardId);
  }
}
