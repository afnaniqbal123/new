# DTOs, Validation & Mongoose Schemas

## DTOs & Validation

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
```

**Rules:**

- Every DTO field must have `@ApiProperty()` for Swagger visibility.
- Use `class-validator` decorators for all validation — no manual `if` checks in controllers.
- The global `CustomValidationPipe` is set with `whitelist: true`, which strips unknown properties automatically.
- Optional fields use `@IsOptional()` **first**, then type decorators.
- For partial update DTOs, prefer `PartialType(CreateXxxDto)` from `@nestjs/mapped-types`.
- DTO class names always end with `Dto` — `SignInDto`, `CreateRoomDto`.

---

## Mongoose Schemas

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  USER_ROLES,
  USER_STATUS,
} from 'src/modules/user/constants/user.constant';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, lowercase: true, type: String })
  name: string;

  @Prop({ required: true, enum: Object.values(USER_ROLES), type: String })
  role: USER_ROLES;
}

export const UserSchema = SchemaFactory.createForClass(User);
export type UserDocument = User & Document;
```

**Rules:**

- Always pass `{ timestamps: true }` to `@Schema` unless explicitly not needed.
- Always specify `type:` inside `@Prop` options for clarity.
- Always export three things from a schema file: the class, the schema (`XxxSchema`), and the document type (`XxxDocument`).
- Use `enum: Object.values(SomeEnum)` with an imported TypeScript enum — never hard-code string arrays.
- Sensitive fields (e.g. `password`) must be removed in `toJSON` override:

```typescript
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};
```
