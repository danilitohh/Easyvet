import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
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
