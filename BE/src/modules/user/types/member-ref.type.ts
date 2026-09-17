import { Types } from 'mongoose';

/**
 * What a team member looks like to modules outside `user`.
 *
 * The third of the boundary contracts in this codebase, alongside
 * `ProductView` and `SaleRef`, and here for the same reason: a consumer that
 * depends on `user.schema.ts` is coupled to how the user module stores
 * things, and `architecture:check` blocks that import.
 *
 * Typed `_id` rather than `unknown` matters practically: `String(unknown)`
 * silently produces "[object Object]", which as a notification recipient id
 * means the notification goes nowhere and nothing reports an error.
 */
export interface MemberRef {
  readonly _id: Types.ObjectId;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}
