import { IsString, IsNotEmpty, IsInt, IsOptional, IsEmail, IsBoolean, IsDateString, IsEnum, IsNumber } from 'class-validator';
import { ContactStatus } from '@prisma/client'; // Assuming you have an Enum defined

export class CreateContactDto {
  @IsInt()
  @IsOptional()
  originalProspectId?: number;

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

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  originType?: string; // <-- Agregado (lo envía el frontend)

  @IsInt()
  @IsOptional()
  campaignId?: number;

  @IsInt()
  @IsOptional()
  sellerId?: number;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsEnum(ContactStatus) // Asegúrate de que ContactStatus esté importado
  @IsOptional()
  contactStatus?: ContactStatus;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsInt()
  @IsOptional()
  paymentInstallments?: number;

  @IsNumber()
  @IsOptional()
  I1?: number;

  @IsNumber()
  @IsOptional()
  I2?: number;

  @IsNumber()
  @IsOptional()
  I3?: number;

  @IsNumber()
  @IsOptional()
  I4?: number;

  @IsNumber()
  @IsOptional()
  I5?: number;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsBoolean()
  @IsOptional()
  isSale?: boolean;

  @IsBoolean()
  @IsOptional()
  markSale?: boolean;

  @IsDateString()
  @IsOptional()
  soldAt?: string;

  @IsString()
  @IsOptional()
  createdAt?: string; // <-- Agregado (El string 'YYYY-MM-DD' que envía el frontend)
}