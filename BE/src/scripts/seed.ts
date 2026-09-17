import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
// #region module:stripe
import { ConfigService } from '@nestjs/config';
// #endregion module:stripe
import type { Model } from 'mongoose';

import { AppModule } from '../app.module';
// #region module:stripe
import { CONFIG } from '../constants/config.constant';
// #endregion module:stripe
// #region module:notifications
import { User, UserDocument } from '../modules/user/user.schema';
import { NotificationService } from '../modules/notifications/services/notification.service';
import {
  Notification,
  NotificationDocument,
} from '../modules/notifications/schemas/notification.schema';
// #endregion module:notifications
// #region module:stripe
import { StripeService } from '../modules/stripe/stripe.service';
import {
  Subscription,
  SubscriptionDocument,
} from '../modules/stripe/subscription/schemas/subscription.schema';
// #endregion module:stripe

// #region module:notifications
const SAMPLE_NOTIFICATIONS: ReadonlyArray<{
  type: string;
  title: string;
  message: string;
}> = [
  {
    type: 'welcome',
    title: 'Welcome aboard',
    message: 'Thanks for signing up — glad to have you here.',
  },
  {
    type: 'update',
    title: 'New feature shipped',
    message: 'Check out what changed in the latest release.',
  },
  {
    type: 'reminder',
    title: 'Reminder',
    message: 'You have something waiting for your review.',
  },
  {
    type: 'info',
    title: 'Tip',
    message: 'You can update your profile and avatar from Settings.',
  },
];

/** Reuses NotificationService.sendToUser so seeded rows get a matching
 * NotificationReadStatus entry the same way a real notification would. */
async function seedNotifications(
  userModel: Model<UserDocument>,
  notificationModel: Model<NotificationDocument>,
  notificationsService: NotificationService,
): Promise<void> {
  const users = await userModel.find().select('_id');

  if (!users.length) {
    console.log(
      '[seed] No users found — sign up at least one user before seeding notifications.',
    );
    return;
  }

  let seededFor = 0;

  for (const user of users) {
    const userId = user._id.toString();
    const existingCount = await notificationModel.countDocuments({
      userId: user._id,
    });
    if (existingCount > 0) continue;

    for (const sample of SAMPLE_NOTIFICATIONS) {
      await notificationsService.sendToUser(userId, sample);
    }
    seededFor += 1;
  }

  console.log(
    `[seed] Seeded notifications for ${seededFor} user(s) (${
      users.length - seededFor
    } already had some).`,
  );
}

// #endregion module:notifications

// #region module:stripe
const SAMPLE_PLANS = [
  {
    name: 'Basic',
    amount: 900,
    interval: 'month',
    description: 'For individuals getting started.',
    features: ['1 project', 'Community support'],
  },
  {
    name: 'Pro',
    amount: 2900,
    interval: 'month',
    description: 'For growing teams.',
    features: ['Unlimited projects', 'Priority support'],
  },
  {
    name: 'Enterprise',
    amount: 9900,
    interval: 'month',
    description: 'For larger organizations.',
    features: ['Unlimited everything', 'Dedicated support'],
  },
] as const;

/** Creates real Stripe Products/Prices (test mode) so the seeded plans have a
 * stripePriceId that Checkout Sessions can actually use — a fake id would
 * make the "subscribe" flow fail at Stripe's API, not just look empty. */
async function seedStripePlans(
  configService: ConfigService,
  stripeService: StripeService,
  subscriptionModel: Model<SubscriptionDocument>,
): Promise<void> {
  if (!configService.get<string>(CONFIG.STRIPE_SECRET_KEY)) {
    console.log(
      '[seed] STRIPE_SECRET_KEY not set — skipping subscription plan seeding.',
    );
    return;
  }

  const stripe = stripeService.getStripeClient();
  let created = 0;

  for (const plan of SAMPLE_PLANS) {
    const existing = await subscriptionModel.findOne({ name: plan.name });
    if (existing) continue;

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: 'usd',
      recurring: { interval: plan.interval },
    });

    await subscriptionModel.create({
      name: plan.name,
      stripePriceId: price.id,
      description: plan.description,
      amount: plan.amount,
      currency: 'usd',
      interval: plan.interval,
      features: [...plan.features],
      isActive: true,
    });
    created += 1;
  }

  console.log(
    `[seed] Seeded ${created} Stripe subscription plan(s) (${
      SAMPLE_PLANS.length - created
    } already existed).`,
  );
}

// #endregion module:stripe

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  // #region module:notifications
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const notificationModel = app.get<Model<NotificationDocument>>(
    getModelToken(Notification.name),
  );
  const notificationsService = app.get(NotificationService);
  await seedNotifications(userModel, notificationModel, notificationsService);
  // #endregion module:notifications
  // #region module:stripe
  const configService = app.get(ConfigService);
  const stripeService = app.get(StripeService);
  const subscriptionModel = app.get<Model<SubscriptionDocument>>(
    getModelToken(Subscription.name),
  );
  await seedStripePlans(configService, stripeService, subscriptionModel);
  // #endregion module:stripe

  await app.close();
}

void bootstrap();
