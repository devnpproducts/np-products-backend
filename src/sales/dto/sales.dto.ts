import { IsString, IsNotEmpty, IsNumber, IsOptional, ValidateNested, IsArray, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleProductDto {
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  price!: number;
}

export class CreateSaleDto {
  @IsNumber()
  @IsOptional()
  contactId?: number;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsString()
  @IsNotEmpty()
  clientName!: string;

  @IsString()
  @IsNotEmpty()
  clientLastName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

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

  @IsNumber()
  grossAmount!: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  netAmount!: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @IsNumber()
  @IsOptional()
  paymentInstallments?: number;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsString()
  @IsOptional()
  cardHolder?: string;

  @IsString()
  @IsOptional()
  cardNumber?: string;

  @IsString()
  @IsOptional()
  cardExp?: string;

  @IsString()
  @IsOptional()
  cardCvc?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleProductDto)
  products!: SaleProductDto[];

}

export class UpdateSaleDto {
  @IsNumber()
  @IsOptional()
  contactId?: number;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientLastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

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

  @IsNumber()
  @IsOptional()
  grossAmount?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  @IsOptional()
  netAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsNumber()
  @IsOptional()
  paymentInstallments?: number;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  cardHolder?: string;

  @IsString()
  @IsOptional()
  cardNumber?: string;

  @IsString()
  @IsOptional()
  cardExp?: string;

  @IsString()
  @IsOptional()
  cardCvc?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  trackingLink?: string;

  @IsString()
  @IsOptional()
  packageStatus?: string;

  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @IsDateString()
  @IsOptional()
  dispatchDate?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SaleProductDto)
  products?: SaleProductDto[];

}

export class BulkCreateSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleDto)
  sales!: CreateSaleDto[];
}