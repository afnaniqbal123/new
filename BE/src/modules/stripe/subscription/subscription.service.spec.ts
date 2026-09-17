import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { STRIPE_ERRORS } from 'src/modules/stripe/constants/api-response/stripe.response';
import { UserService } from 'src/modules/user/user.service';
import { CardService } from '../card/card.service';
import { StripeService } from '../stripe.service';
import { Subscription } from './schemas/subscription.schema';
import { UserSubscription } from './schemas/user-subscription.schema';
import { PlanIntervalEnum } from './enums/plan-interval.enum';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SubscriptionService } from './subscription.service';

const PRODUCT_ID = 'prod_test123';
const PRICE_ID = 'price_test123';

const planDto = (overrides: Partial<CreatePlanDto> = {}): CreatePlanDto => ({
  name: 'Pro',
  amount: 2900,
  interval: PlanIntervalEnum.MONTH,
  ...overrides,
});

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let stripe: {
    products: { create: jest.Mock; update: jest.Mock };
    prices: { create: jest.Mock };
  };
  let subscriptionModel: { findOne: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    stripe = {
      products: {
        create: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
        update: jest.fn().mockResolvedValue({ id: PRODUCT_ID, active: false }),
      },
      prices: { create: jest.fn().mockResolvedValue({ id: PRICE_ID }) },
    };
    subscriptionModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((doc: unknown) => doc),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getModelToken(Subscription.name),
          useValue: subscriptionModel,
        },
        { provide: getModelToken(UserSubscription.name), useValue: {} },
        { provide: StripeService, useValue: { getStripeClient: () => stripe } },
        { provide: UserService, useValue: {} },
        { provide: CardService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('createPlan', () => {
    it('creates a Stripe product and a recurring price for the plan', async () => {
      await service.createPlan(
        planDto({ name: 'Pro', amount: 2900, description: 'For teams.' }),
      );

      expect(stripe.products.create).toHaveBeenCalledWith({
        name: 'Pro',
        description: 'For teams.',
      });
      // Stripe's literal, not `PlanIntervalEnum.MONTH`. Asserting with our own
      // enum would agree with the code however the interval map was written,
      // which is the one thing this assertion exists to check.
      expect(stripe.prices.create).toHaveBeenCalledWith({
        product: PRODUCT_ID,
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
    });

    it("prices a yearly plan on Stripe's yearly interval", async () => {
      await service.createPlan(planDto({ interval: PlanIntervalEnum.YEAR }));

      expect(stripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({ recurring: { interval: 'year' } }),
      );
    });

    it('stores the plan against the price id the catalogue subscribes with', async () => {
      const result = await service.createPlan(planDto());

      expect(subscriptionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pro',
          stripePriceId: PRICE_ID,
          amount: 2900,
          currency: 'usd',
          interval: PlanIntervalEnum.MONTH,
          isActive: true,
        }),
      );
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toMatchObject({ stripePriceId: PRICE_ID });
    });

    /**
     * The catalogue is keyed by name for humans and by price id for billing.
     * Two plans called "Pro" is an operator mistake, and letting it through
     * would leave a second live Product in the Stripe account that no local
     * row points at.
     */
    it('refuses a name already in the catalogue, before anything reaches Stripe', async () => {
      subscriptionModel.findOne.mockResolvedValue({ name: 'Pro' });

      await expect(service.createPlan(planDto())).rejects.toThrow(
        HttpException,
      );

      expect(stripe.products.create).not.toHaveBeenCalled();
      expect(stripe.prices.create).not.toHaveBeenCalled();
      expect(subscriptionModel.create).not.toHaveBeenCalled();
    });

    it('reports a duplicate name as a conflict', async () => {
      subscriptionModel.findOne.mockResolvedValue({ name: 'Pro' });

      const error = await service
        .createPlan(planDto())
        .catch((e: unknown) => e);
      const body = (error as HttpException).getResponse() as {
        status: number;
        message: string;
      };

      expect(body.status).toBe(HttpStatus.CONFLICT);
      expect(body.message).toBe(STRIPE_ERRORS.PLAN_ALREADY_EXISTS);
    });

    /**
     * The pre-check is a read, so it cannot see a plan another request is
     * inserting at the same moment — both callers pass it and both reach the
     * write. The unique index on `name` is what actually rejects the second
     * one, and this pins that the loser is answered as the conflict it is rather
     * than as a server fault. Its Stripe Product is archived on the way out by
     * the same catch that handles any failed write, covered below.
     */
    describe('when two requests create the same plan at once', () => {
      /** MongoDB's unique-index violation, as the driver reports it. */
      const duplicateKey = Object.assign(new Error('E11000 duplicate key'), {
        code: 11000,
      });

      it('answers the losing writer with a conflict, not a server error', async () => {
        subscriptionModel.findOne.mockResolvedValue(null);
        subscriptionModel.create.mockRejectedValue(duplicateKey);

        const error = await service
          .createPlan(planDto())
          .catch((e: unknown) => e);
        const body = (error as HttpException).getResponse() as {
          status: number;
          message: string;
        };

        expect(body.status).toBe(HttpStatus.CONFLICT);
        expect(body.message).toBe(STRIPE_ERRORS.PLAN_ALREADY_EXISTS);
      });
    });

    /**
     * Stripe is a second system with its own state, and a Product outlives the
     * request that made it. If the catalogue row never lands there is nothing
     * left pointing at that Product, so it is archived rather than left live
     * in the operator's dashboard looking like a sellable plan.
     */
    it('archives the Stripe product when the catalogue write fails', async () => {
      subscriptionModel.create.mockRejectedValue(new Error('write failed'));

      await expect(service.createPlan(planDto())).rejects.toThrow(
        HttpException,
      );

      expect(stripe.products.update).toHaveBeenCalledWith(PRODUCT_ID, {
        active: false,
      });
    });

    it('reports the failed write rather than the price it had to abandon', async () => {
      subscriptionModel.create.mockRejectedValue(new Error('write failed'));

      const error = await service
        .createPlan(planDto())
        .catch((e: unknown) => e);
      const body = (error as HttpException).getResponse() as {
        status: number;
        message: string;
      };

      expect(body.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe(STRIPE_ERRORS.PLAN_CREATION_FAILED);
    });

    it('still reports the write failure when archiving the product also fails', async () => {
      subscriptionModel.create.mockRejectedValue(new Error('write failed'));
      stripe.products.update.mockRejectedValue(new Error('stripe unreachable'));

      const error = await service
        .createPlan(planDto())
        .catch((e: unknown) => e);
      const body = (error as HttpException).getResponse() as {
        message: string;
      };

      expect(body.message).toBe(STRIPE_ERRORS.PLAN_CREATION_FAILED);
    });

    /**
     * The same hole as the failed write, one step earlier: once the Product
     * exists it is live in the operator's Stripe account, and a Price that
     * never got created leaves it there with nothing pointing at it.
     */
    it('archives the Stripe product when the price cannot be created', async () => {
      stripe.prices.create.mockRejectedValue(new Error('stripe rejected'));

      await expect(service.createPlan(planDto())).rejects.toThrow(
        HttpException,
      );

      expect(stripe.products.update).toHaveBeenCalledWith(PRODUCT_ID, {
        active: false,
      });
      expect(subscriptionModel.create).not.toHaveBeenCalled();
    });

    it('reports a failure to create the product in the response envelope', async () => {
      stripe.products.create.mockRejectedValue(new Error('stripe rejected'));

      const error = await service
        .createPlan(planDto())
        .catch((e: unknown) => e);
      const body = (error as HttpException).getResponse() as {
        status: number;
        message: string;
      };

      expect(body.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe(STRIPE_ERRORS.PLAN_CREATION_FAILED);
      // Nothing was created, so there is nothing to retire.
      expect(stripe.products.update).not.toHaveBeenCalled();
    });
  });
});
