import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StripeService } from '../stripe.service';
import { Card, CardDocument } from './schemas/card.schema';
import { AddCardDto } from './dto/add-card.dto';
import Stripe from 'stripe';
import { UserService } from 'src/modules/user/user.service';
import {
  SerializeHttpResponse,
  SerializeHttpError,
  SuccessResponse,
} from 'src/utils/serializer';
import {
  STRIPE_SUCCESS,
  STRIPE_ERRORS,
} from 'src/modules/stripe/constants/api-response/stripe.response';

@Injectable()
export class CardService {
  constructor(
    @InjectModel(Card.name)
    private readonly cardModel: Model<CardDocument>,
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
  ) {}

  async addCard(
    userId: string,
    addCardDto: AddCardDto,
  ): Promise<SuccessResponse<CardDocument>> {
    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;

    // TODO: Ensure your User entity has a stripeCustomerId field (nullable string)
    if (!user.stripeCustomerId) {
      // Create or get Stripe customer
      const stripeCustomer = await this.stripeService.getOrCreateStripeCustomer(
        user as any,
      );
      // Update user with stripe customer ID using update method
      await this.userService.update(
        userId,
        { stripeCustomerId: stripeCustomer.id } as any,
        undefined as any,
      );
    }

    const stripe = this.stripeService.getStripeClient();

    try {
      await stripe.paymentMethods.attach(addCardDto.paymentMethodId, {
        customer: user.stripeCustomerId,
      });
    } catch (attachError) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.PAYMENT_METHOD_ATTACHMENT_FAILED,
      );
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(
      addCardDto.paymentMethodId,
    );

    if (paymentMethod.type !== 'card') {
      throw new BadRequestException(
        SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          STRIPE_ERRORS.INVALID_PAYMENT_METHOD,
        ),
      );
    }

    const card = paymentMethod.card;
    if (!card) {
      throw new BadRequestException(
        SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          STRIPE_ERRORS.PAYMENT_METHOD_NOT_FOUND,
        ),
      );
    }

    // Check if a card with the same fingerprint already exists for this user
    const existingCards = await this.cardModel.find({ userId });

    // Get all payment methods for this user to check fingerprints
    const userPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    // Check if any existing card has the same fingerprint
    const duplicateCard = userPaymentMethods.data.find(
      (pm) => pm.card?.fingerprint === card.fingerprint,
    );

    if (duplicateCard) {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.DUPLICATE_CARD,
      );
    }

    const isDefault = existingCards.length === 0;

    // Create card record in database
    const cardEntity = new this.cardModel({
      userId,
      stripePaymentMethodId: addCardDto.paymentMethodId,
      last4: card.last4,
      brand: card.brand,
      expiryMonth: card.exp_month,
      expiryYear: card.exp_year,
      isDefault,
    });

    const savedCard = await cardEntity.save();

    // If this is the default card, update Stripe customer
    if (isDefault) {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: addCardDto.paymentMethodId,
        },
      });
    }

    return SerializeHttpResponse(
      savedCard,
      HttpStatus.CREATED,
      STRIPE_SUCCESS.CARD_ADDED,
    );
  }

  async getCards(userId: string): Promise<SuccessResponse<CardDocument[]>> {
    const cards = await this.cardModel
      .find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();

    return SerializeHttpResponse(
      cards,
      HttpStatus.OK,
      STRIPE_SUCCESS.CARDS_RETRIEVED,
    );
  }

  async getAllCards(): Promise<SuccessResponse<CardDocument[]>> {
    const cards = await this.cardModel
      .find()
      .populate('userId')
      .sort({ userId: 1, isDefault: -1, createdAt: -1 })
      .exec();

    return SerializeHttpResponse(
      cards,
      HttpStatus.OK,
      STRIPE_SUCCESS.CARDS_RETRIEVED,
    );
  }

  async deleteCard(
    userId: string,
    cardId: string,
  ): Promise<SuccessResponse<null>> {
    const card = await this.cardModel.findOne({
      _id: cardId,
      userId,
    });

    if (!card) {
      throw new NotFoundException(
        SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          STRIPE_ERRORS.CARD_NOT_FOUND,
        ),
      );
    }

    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;
    const stripe = this.stripeService.getStripeClient();

    // Check if payment method is attached before trying to detach
    const isAttached = user.stripeCustomerId
      ? await this.isPaymentMethodAttached(
          card.stripePaymentMethodId,
          user.stripeCustomerId,
        )
      : false;

    if (isAttached) {
      try {
        await stripe.paymentMethods.detach(card.stripePaymentMethodId);
      } catch (stripeError) {
        return SerializeHttpError(
          null,
          HttpStatus.BAD_REQUEST,
          STRIPE_ERRORS.PAYMENT_METHOD_DETACHMENT_FAILED,
        );
      }
    } else {
      return SerializeHttpError(
        null,
        HttpStatus.BAD_REQUEST,
        STRIPE_ERRORS.PAYMENT_METHOD_NOT_ATTACHED,
      );
    }

    // If this was the default card, find another card to make default
    if (card.isDefault) {
      // Get remaining cards for this user (excluding the one being deleted)
      const remainingCards = await this.cardModel.find({ userId });

      // Filter out the card being deleted
      const otherCards = remainingCards.filter(
        (c) => (c._id as any).toString() !== cardId,
      );

      if (otherCards.length > 0) {
        // Set the first remaining card as default
        const newDefaultCard = otherCards[0];
        newDefaultCard.isDefault = true;
        await newDefaultCard.save();

        // Update Stripe customer default payment method
        if (user.stripeCustomerId) {
          try {
            await stripe.customers.update(user.stripeCustomerId, {
              invoice_settings: {
                default_payment_method: newDefaultCard.stripePaymentMethodId,
              },
            });
          } catch (stripeError) {
            return SerializeHttpError(
              null,
              HttpStatus.BAD_REQUEST,
              STRIPE_ERRORS.CUSTOMER_UPDATE_FAILED,
            );
          }
        }
      } else if (user.stripeCustomerId) {
        // No cards left, remove default payment method
        try {
          await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: undefined,
            },
          });
        } catch (stripeError) {
          return SerializeHttpError(
            null,
            HttpStatus.BAD_REQUEST,
            STRIPE_ERRORS.CUSTOMER_UPDATE_FAILED,
          );
        }
      }
    }

    // Delete card from database
    await this.cardModel.findByIdAndDelete(cardId);
    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      STRIPE_SUCCESS.CARD_DELETED,
    );
  }

  async setDefaultCard(
    userId: string,
    cardId: string,
  ): Promise<SuccessResponse<CardDocument>> {
    const card = await this.cardModel.findOne({
      _id: cardId,
      userId,
    });

    if (!card) {
      throw new NotFoundException(
        SerializeHttpError(
          null,
          HttpStatus.NOT_FOUND,
          STRIPE_ERRORS.CARD_NOT_FOUND,
        ),
      );
    }

    const userResult = await this.userService.findOne(userId);
    if (!userResult || !userResult.data) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        STRIPE_ERRORS.CUSTOMER_NOT_FOUND,
      );
    }
    const user = userResult.data;
    const stripe = this.stripeService.getStripeClient();

    // Update all cards to not be default
    await this.cardModel.updateMany({ userId }, { isDefault: false });

    // Set this card as default
    card.isDefault = true;
    const updatedCard = await card.save();

    // Update Stripe customer default payment method
    if (user.stripeCustomerId) {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: card.stripePaymentMethodId,
        },
      });
    }

    return SerializeHttpResponse(
      updatedCard,
      HttpStatus.OK,
      STRIPE_SUCCESS.CARD_SET_DEFAULT,
    );
  }

  private async isPaymentMethodAttached(
    paymentMethodId: string,
    customerId: string,
  ): Promise<boolean> {
    try {
      const stripe = this.stripeService.getStripeClient();
      const paymentMethod =
        await stripe.paymentMethods.retrieve(paymentMethodId);
      return paymentMethod.customer === customerId;
    } catch (error) {
      return false;
    }
  }
}
