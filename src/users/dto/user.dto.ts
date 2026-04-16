import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  user!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  passwordView?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  dni?: string;
}

export class UpdateUserDto {
  @IsString() @IsOptional()
  user?: string;

  @IsString() @IsOptional()
  password?: string;

  @IsString() @IsOptional()
  passwordView?: string;

  @IsString() @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  role?: string;

  @IsString() @IsOptional()
  dni?: string;

  @IsBoolean() @IsOptional()
  status?: boolean;

  @IsInt() @IsOptional()
  managerId?: number;
}