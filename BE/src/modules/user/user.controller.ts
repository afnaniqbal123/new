import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { GetUser } from 'src/modules/auth/decorator/user.decorator';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CreateUserDto, UpdateUserDto, ChangeEmailDto } from './dto/user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetOrganizationId } from 'src/modules/auth/decorator/organization.decorator';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TenantScoped } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { USER_SUBJECT } from 'src/modules/user/constants/user-subject.constant';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
// Order matters, and Nest only respects it within a single @UseGuards.
// OrganizationAccessGuard must establish tenant context *before*
// PermissionsGuard builds the ability, or every tenant-conditioned rule
// evaluates against `undefined`. It stands aside on routes without
// @TenantScoped(), so listing it here costs the other routes nothing.
@UseGuards(OrganizationAccessGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.create(createUserDto, file);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.userService.findAll(search);
  }

  // Tenant-scoped. The organization guard resolves and authorizes the
  // requested organization before the handler runs, so the id arriving in
  // `organizationId` is one this caller is entitled to — not merely one they
  // asked for.
  @Get('all')
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: USER_SUBJECT })
  findAllUsers(@GetOrganizationId() organizationId: string) {
    return this.userService.findAllUsers(organizationId);
  }

  // Two checks on every single-record route, and both are needed. The guard answers "may this caller read
  // users at all?" before anything is loaded; the service answers "may they
  // read *this* one?" once it has the record. CASL's name-only check ignores
  // conditions, so the self-grant every caller holds would otherwise walk
  // straight past the guard.
  @Get(':id')
  @RequirePermissions({ action: Action.Read, subject: USER_SUBJECT })
  findOne(
    @Param('id') id: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    return this.userService.findOneAuthorized(id, ability);
  }

  @Patch('change-email')
  changeEmail(
    @GetUser('id') userId: string,
    @Body() changeEmailDto: ChangeEmailDto,
  ) {
    return this.userService.changeEmail(userId, changeEmailDto);
  }

  // Self-service profile update — any authenticated user may edit their own
  // profile/avatar, unlike the admin `PATCH :id` below. Must be registered
  // before `PATCH :id` or Nest's route matching would treat "me" as an :id.
  // SECURITY: only whitelisted fields are forwarded. `role` must stay
  // admin-only (self-service would be privilege escalation); `email` and
  // `password` each have their own password-verified flow — `changeEmail`
  // above and `POST /auth/change-password` — and writing them here would skip
  // the current-password check and, for `password`, the session revocation
  // that makes a compromised token recoverable.
  //
  // This list is duplicated as SELF_EDITABLE_FIELDS in user.policy.ts, which
  // is what guards the sibling `PATCH :id` route. Change both together.
  @Patch('me')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  updateMe(
    @GetUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { name, phone, languagePreference } = updateUserDto;
    return this.userService.update(
      userId,
      { name, phone, languagePreference },
      file,
    );
  }

  @Patch(':id')
  @RequirePermissions({ action: Action.Update, subject: USER_SUBJECT })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    return this.userService.updateAuthorized(id, updateUserDto, file, ability);
  }

  @Delete(':id')
  @RequirePermissions({ action: Action.Delete, subject: USER_SUBJECT })
  remove(
    @Param('id') id: string,
    @GetAbility() ability: AppAbility | undefined,
  ) {
    return this.userService.removeAuthorized(id, ability);
  }
}
