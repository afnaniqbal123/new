import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';
import { AUTH_PROVIDER } from 'src/modules/auth/constants/auth.constant';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, lowercase: true, type: String })
  name: string;

  @Prop({
    trim: true,
    unique: true,
    type: String,
    required: true,
    lowercase: true,
  })
  email: string;

  @Prop({ required: true, trim: true, type: String })
  phone: string;

  @Prop({ required: true, enum: Object.values(USER_ROLES), type: String })
  role: USER_ROLES;

  @Prop({ required: true, type: String })
  password: string;

  @Prop({ required: true, default: false, type: Boolean })
  emailVerified: boolean;

  @Prop({
    required: true,
    type: String,
    default: USER_STATUS.PENDING,
    enum: Object.values(USER_STATUS),
  })
  status: USER_STATUS;

  @Prop({ type: String })
  avatar: string;

  // ISO 639-1 code (e.g. 'en', 'de') — mirrors SUPPORTED_LOCALES on the
  // frontend (templates/react-vite/base/src/i18n/index.ts). Not constrained
  // to an enum here since the FE owns which locales actually ship.
  @Prop({ type: String, default: 'en' })
  languagePreference: string;

  @Prop({
    type: String,
    enum: Object.values(AUTH_PROVIDER),
    default: AUTH_PROVIDER.CUSTOM,
  })
  provider: AUTH_PROVIDER;

  /**
   * Tenant this user belongs to. Authoritative for `OrganizationAccessGuard`:
   * it is what a caller-supplied `x-organization-id` is checked against, and
   * what `UserService.findAllUsers` already filtered on before the field
   * existed on the schema.
   */
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organization: Types.ObjectId;

  @Prop({ type: String })
  stripeCustomerId: string;

  @Prop({ type: String })
  paypalCustomerId: string;

  @Prop({ type: String })
  paypalSubscriptionId: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

export type UserDocument = User & Document;

UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};
