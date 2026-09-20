import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

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
