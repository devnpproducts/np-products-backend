import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty, IsArray } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsBoolean() @IsOptional()
  status?: boolean;

  @IsInt() @IsOptional()
  managerId?: number;
}