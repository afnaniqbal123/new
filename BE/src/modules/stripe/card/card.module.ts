import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeModule } from '../stripe.module';
import { Card, CardSchema } from './schemas/card.schema';
import { CardService } from './card.service';
import { CardController } from './card.controller';
import { UserModule } from 'src/modules/user/user.module';

/**
 * Card module for managing Stripe payment methods.
 * This module handles card operations (add, retrieve, delete, set default).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Card.name, schema: CardSchema }]),
    StripeModule,
    forwardRef(() => UserModule), // TODO: Replace with your actual User module
  ],
  providers: [CardService],
  controllers: [CardController],
  exports: [CardService],
})
export class CardModule {}
