import { Model, Types, type UpdateQuery } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  UserSuccessMessages,
  UserErrorMessages,
} from 'src/modules/user/constants/api-response/user.response';
import { User, UserDocument } from './user.schema';
import { Injectable, HttpStatus } from '@nestjs/common';
import {
  createHashPassword,
  comparePassword,
  generatePassword,
} from 'src/modules/auth/utils/auth.util';
import {
  SerializeHttpError,
  SerializeHttpResponse,
} from 'src/utils/serializer';
import { CreateUserDto, UpdateUserDto, ChangeEmailDto } from './dto/user.dto';
import {
  OWNERSHIP_ROLES,
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';
import { MediaService } from '../media/media.service';
import { FOLDER_NAME } from 'src/modules/media/constants/media.constant';
import { EmailService } from '../email/services/email-service';
import { ITemplates } from 'src/types/templates.type';
import { AuthorizationService } from 'src/modules/authorization/authorization.service';
import { CredentialRevocationService } from 'src/modules/auth/services/credential-revocation.service';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { USER_SUBJECT } from 'src/modules/user/constants/user-subject.constant';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mediaService: MediaService,
    private readonly emailService: EmailService,
    private readonly authorizationService: AuthorizationService,
    private readonly credentialRevocation: CredentialRevocationService,
  ) {}

  async create(createUserDto: CreateUserDto, file: Express.Multer.File) {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email.toLowerCase(),
    });

    if (existingUser) {
      return SerializeHttpResponse(
        null,
        HttpStatus.BAD_REQUEST,
        UserErrorMessages.ALREADY_EXISTS,
      );
    }

    const password = generatePassword();
    const hashedPassword = await createHashPassword(password);
    // Typed rather than `any`: `organization` and `avatar` are set below and
    // `organization` is widened from the DTO's string to an ObjectId, so the
    // shape genuinely differs from `CreateUserDto`.
    const payload: Partial<User> = {
      ...createUserDto,
      organization: undefined,
      password: hashedPassword,
      status: USER_STATUS.ACTIVE,
    };

    if (createUserDto.organization) {
      payload.organization = new Types.ObjectId(createUserDto.organization);
    }

    if (file) {
      const folder = `${FOLDER_NAME.PROFILE}/${createUserDto.email}`;
      const resp = await this.mediaService.uploadFile(folder, file);
      payload.avatar = resp?.url || '';
    }

    const user = await this.userModel.create(payload);
    await user.populate('organization');

    const emailPayload = {
      email: user.email,
      invitedUserName: user.name,
      password: password,
      userRole: user.role.toLocaleLowerCase(),
    };

    await this.sendOnBoardingEmail(emailPayload);

    return SerializeHttpResponse(
      user,
      HttpStatus.CREATED,
      UserSuccessMessages.CREATED,
    );
  }

  async sendOnBoardingEmail(payload: {
    email: string;
    invitedUserName: string;
    password: string;
    // Rendered into the welcome template so an invitee is told which job
    // they were given, not just that an account exists.
    userRole?: string;
  }) {
    const template = await this.emailService.loadTemplate(
      ITemplates.NEW_USER,
      payload,
    );

    const subject = 'Welcome to "Platform Name"';
    await this.emailService.sendEmail(payload.email, subject, template);
  }

  async findAll(search?: string) {
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const users = await this.userModel.find(filter).select('-password');
    return SerializeHttpResponse(
      users,
      HttpStatus.OK,
      UserSuccessMessages.RETRIEVED_ALL,
    );
  }

  async findAllUsers(organizationId: string) {
    const users = await this.userModel
      .find({ organization: new Types.ObjectId(organizationId) })
      .select('-password');

    return SerializeHttpResponse(
      users,
      HttpStatus.OK,
      UserSuccessMessages.RETRIEVED_ALL,
    );
  }

  /**
   * Load a user and refuse unless the caller may perform `action` on *that*
   * record.
   *
   * The route guard cannot decide this. `@RequirePermissions` asks CASL a
   * name-only question, and CASL answers name-only questions without
   * evaluating conditions — so every authenticated caller clears a guard on
   * the strength of a grant conditioned on their own id. Without this second
   * stage, "edit your own profile" silently becomes "edit anyone's".
   *
   * Returns the loaded document so callers do not read it twice.
   */
  private async loadAuthorized(
    id: string,
    action: Action,
    ability: AppAbility | undefined,
    fields?: readonly string[],
  ): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id).select('-password');

    // Absence is reported as 404 by the caller; there is nothing to authorize
    // against, and consulting the ability here would leak existence through
    // the difference between 403 and 404.
    if (!user) {
      return null;
    }

    this.authorizationService.assertCan(
      ability,
      action,
      USER_SUBJECT,
      user.toObject() as unknown as Record<string, unknown>,
      fields,
    );

    return user;
  }

  async findOneAuthorized(id: string, ability: AppAbility | undefined) {
    const user = await this.loadAuthorized(id, Action.Read, ability);

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    return SerializeHttpResponse(
      user,
      HttpStatus.OK,
      UserSuccessMessages.RETRIEVED,
    );
  }

  async updateAuthorized(
    id: string,
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File,
    ability: AppAbility | undefined,
  ) {
    // The fields actually being written decide this, not the DTO's shape — a
    // caller who sends only `name` is not attempting a role change. `avatar`
    // is added explicitly because `update` writes it from the uploaded file,
    // not from the DTO, so enumerating the DTO alone would let it through
    // unchecked.
    const attemptedFields = Object.keys(updateUserDto).filter(
      (key) => updateUserDto[key as keyof UpdateUserDto] !== undefined,
    );
    if (file) {
      attemptedFields.push('avatar');
    }
    // Written by `update` as a consequence of changing the address, so it is a
    // field being written and has to be declared like any other.
    if (updateUserDto.email) {
      attemptedFields.push('emailVerified');
    }

    const user = await this.loadAuthorized(
      id,
      Action.Update,
      ability,
      attemptedFields,
    );

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    return this.update(id, updateUserDto, file);
  }

  /**
   * Also the only place the policy's `cannot(Delete, { _id: self })` carve-out
   * takes effect: the guard's name-only check cannot see it.
   */
  async removeAuthorized(id: string, ability: AppAbility | undefined) {
    const user = await this.loadAuthorized(id, Action.Delete, ability);

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    return this.remove(id);
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).select('-password');

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    return SerializeHttpResponse(
      user,
      HttpStatus.OK,
      UserSuccessMessages.RETRIEVED,
    );
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File,
  ) {
    const user = await this.userModel.findById(id);

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    // Typed rather than `any`: the fields set below (`password`,
    // `emailVerified`, `avatar`) are not all on the DTO, so this is a `User`
    // patch rather than the DTO itself.
    const payload: UpdateQuery<UserDocument> = { ...updateUserDto };

    if (updateUserDto.password) {
      payload.password = await createHashPassword(updateUserDto.password);
    }

    // Moving the address must not carry its verified status with it — the
    // dedicated flow in `changeEmail` clears this, and writing the field here
    // has to do the same or an admin edit silently marks an unproven address
    // as verified.
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      payload.emailVerified = false;
    }

    if (file) {
      const folder = `${FOLDER_NAME.PROFILE}/${user.email}`;
      const resp = await this.mediaService.uploadFile(folder, file);
      payload.avatar = resp?.url || '';
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .select('-password');

    // A new password must invalidate what the old one could reach, or an
    // admin resetting a compromised account changes nothing an attacker
    // holds. One call rather than a list, because a list repeated at several
    // sites is what let the OTP channel go unretired for seven review rounds.
    if (updateUserDto.password) {
      await this.credentialRevocation.onPasswordChanged(id, user.email);
    }

    return SerializeHttpResponse(
      updatedUser,
      HttpStatus.OK,
      UserSuccessMessages.UPDATED,
    );
  }

  async remove(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    await this.userModel.findByIdAndDelete(id);

    return SerializeHttpResponse(
      null,
      HttpStatus.OK,
      UserSuccessMessages.DELETED,
    );
  }

  async changeEmail(userId: string, changeEmailDto: ChangeEmailDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      return SerializeHttpResponse(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    const isPasswordValid = await comparePassword(
      changeEmailDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      return SerializeHttpResponse(
        null,
        HttpStatus.UNAUTHORIZED,
        UserErrorMessages.INVALID_PASSWORD,
      );
    }

    const existingUser = await this.userModel.findOne({
      email: changeEmailDto.email.toLowerCase(),
    });

    if (existingUser) {
      return SerializeHttpResponse(
        null,
        HttpStatus.BAD_REQUEST,
        UserErrorMessages.ALREADY_EXISTS,
      );
    }

    user.email = changeEmailDto.email.toLowerCase();
    user.emailVerified = false;
    await user.save();

    return SerializeHttpResponse(
      user,
      HttpStatus.OK,
      UserSuccessMessages.EMAIL_UPDATED,
    );
  }

  // --- Organization membership -------------------------------------------
  //
  // These exist here, rather than in `organization`, because they write the
  // User collection — and `nestjs/no-foreign-schema-read` means the module
  // that owns a collection is the only one allowed to touch it. The
  // OrganizationService calls into these.
  //
  // They deliberately return raw documents rather than envelopes: their
  // caller is another service, not a controller, and double-wrapping a
  // response is how `data.data.data` happens.

  /**
   * Binds the creator to the organization they just made, as its OWNER.
   *
   * Refuses if they already belong to one. A user in two tenants would make
   * every tenant-scoped query ambiguous, and `OrganizationAccessGuard`
   * authorizes against exactly one `user.organization`.
   */
  async attachToOrganization(
    userId: string,
    organizationId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    if (user.organization) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        UserErrorMessages.ALREADY_IN_ORGANIZATION,
      );
    }

    user.organization = new Types.ObjectId(organizationId);
    // OWNER, always: this path exists only for the person who created the
    // workspace. Everyone else arrives through `inviteToOrganization` with an
    // explicitly chosen role.
    user.role = USER_ROLES.OWNER;
    user.status = USER_STATUS.ACTIVE;

    return user.save();
  }

  async listOrganizationMembers(
    organizationId: string,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({ organization: new Types.ObjectId(organizationId) })
      .select('-password')
      .sort({ createdAt: 1 });
  }

  /**
   * Creates a team member with a generated password and emails it to them.
   *
   * Reuses the existing onboarding email rather than inventing an invite
   * token flow: the account is real immediately, and the first thing the
   * recipient is asked to do is change the password.
   */
  async inviteToOrganization(
    organizationId: string,
    dto: { email: string; name: string; phone: string; role: USER_ROLES },
  ): Promise<UserDocument> {
    const email = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email });

    if (existing) {
      return SerializeHttpError(
        null,
        HttpStatus.CONFLICT,
        UserErrorMessages.ALREADY_EXISTS,
      );
    }

    const password = generatePassword();
    const user = await this.userModel.create({
      name: dto.name,
      email,
      phone: dto.phone,
      role: dto.role,
      password: await createHashPassword(password),
      organization: new Types.ObjectId(organizationId),
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
    });

    await this.sendOnBoardingEmail({
      email: user.email,
      invitedUserName: user.name,
      password,
      userRole: user.role.toLowerCase(),
    });

    return user;
  }

  async updateOrganizationMember(
    organizationId: string,
    memberId: string,
    dto: { role?: USER_ROLES; isActive?: boolean },
  ): Promise<UserDocument> {
    const update: UpdateQuery<UserDocument> = {};

    if (dto.role) update.role = dto.role;
    if (dto.isActive !== undefined) {
      update.status = dto.isActive ? USER_STATUS.ACTIVE : USER_STATUS.INACTIVE;
    }

    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(memberId),
          organization: new Types.ObjectId(organizationId),
        },
        { $set: update },
        { returnDocument: 'after' },
      )
      .select('-password');

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    // A role change alters the claims in every access token this user holds,
    // and those are validated without a database read. Revoking is what makes
    // a demotion take effect now rather than in up to 15 minutes.
    if (dto.role || dto.isActive === false) {
      await this.credentialRevocation.onAuthorizationChanged(memberId);
    }

    return user;
  }

  /**
   * Deactivates a member and ends their sessions. Never a hard delete: their
   * id is stamped on every sale they rang up, and those records must keep
   * resolving to a name.
   */
  async removeFromOrganization(
    organizationId: string,
    memberId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(memberId),
          organization: new Types.ObjectId(organizationId),
        },
        { $set: { status: USER_STATUS.INACTIVE } },
        { returnDocument: 'after' },
      )
      .select('-password');

    if (!user) {
      return SerializeHttpError(
        null,
        HttpStatus.NOT_FOUND,
        UserErrorMessages.NOT_FOUND,
      );
    }

    await this.credentialRevocation.onAuthorizationChanged(memberId);

    return user;
  }

  /**
   * Refuses a change that would leave the Organization with no active OWNER.
   *
   * Lives here rather than in `OrganizationService` because answering it means
   * reasoning about the role vocabulary, and this module owns that vocabulary
   * along with the collection it is stored in. A service elsewhere comparing
   * `role === OWNER` would be a second place that decides what ownership
   * means — which is what `nestjs/no-parallel-authorization` exists to stop.
   *
   * This is a domain invariant, not an authorization check: an ownerless
   * organization cannot be billed, transferred or closed by anybody, at any
   * permission level, and recovering from one means editing the database.
   *
   * @param nextRole the role being assigned, or undefined when removing.
   */
  async assertOrganizationKeepsAnOwner(
    organizationId: string,
    memberId: string,
    nextRole?: USER_ROLES,
  ): Promise<void> {
    // Someone who is not currently an owner cannot reduce the owner count,
    // whatever they are being changed to.
    const isOwner = await this.isOrganizationOwner(organizationId, memberId);

    if (!isOwner) return;

    // Reassigning an owner to another ownership-conferring role changes
    // nothing about the count.
    if (nextRole !== undefined && OWNERSHIP_ROLES.includes(nextRole)) return;

    const owners = await this.countOrganizationOwners(organizationId);

    if (owners > 1) return;

    return SerializeHttpError(
      null,
      HttpStatus.CONFLICT,
      UserErrorMessages.LAST_OWNER,
    );
  }

  async isOrganizationOwner(
    organizationId: string,
    memberId: string,
  ): Promise<boolean> {
    const owner = await this.userModel.exists({
      _id: new Types.ObjectId(memberId),
      organization: new Types.ObjectId(organizationId),
      role: { $in: OWNERSHIP_ROLES },
    });

    return owner !== null;
  }

  async countOrganizationOwners(organizationId: string): Promise<number> {
    return this.userModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      role: { $in: OWNERSHIP_ROLES },
      status: USER_STATUS.ACTIVE,
    });
  }

  async countOrganizationMembers(organizationId: string): Promise<number> {
    return this.userModel.countDocuments({
      organization: new Types.ObjectId(organizationId),
      status: { $ne: USER_STATUS.INACTIVE },
    });
  }
}
