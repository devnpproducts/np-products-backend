import { IsString, IsOptional, IsEmail, IsInt, IsBoolean, IsDateString } from 'class-validator';

export class CreateProspectDto {
  @IsString()
  @IsOptional()
  names?: string;

  @IsString()
  @IsOptional()
  lastNames?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  campaignId!: number;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsDateString()
  @IsOptional()
  createdAt?: string;
}

export class UpdateProspectDto extends CreateProspectDto {
  @IsInt()
  @IsOptional()
  sellerId?: number;

  @IsBoolean()
  @IsOptional()
  isContacted?: boolean;

  @IsBoolean()
  @IsOptional()
  isSale?: boolean;
}