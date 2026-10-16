import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegistrationRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  clinicName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsBoolean()
  @Equals(true)
  privacyConsent!: boolean;

  @IsBoolean()
  @Equals(true)
  termsConsent!: boolean;
}

export class PlatformAdminBootstrapDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(512)
  bootstrapSecret!: string;
}

export class EmailRequestDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class TokenRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}

export class PasswordResetRequestDto extends TokenRequestDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class SwitchOrganizationRequestDto {
  @IsUUID()
  membershipId!: string;
}

export class ChangePasswordRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string;
}
