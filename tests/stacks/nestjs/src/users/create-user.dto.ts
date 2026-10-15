import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(1, 100)
  displayName: string;
}
