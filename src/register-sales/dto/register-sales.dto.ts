import { IsString, IsNumber, IsOptional, IsArray, IsInt, IsBoolean, IsDateString } from 'class-validator';

export class CreateRegisterSaleDto {
  // Conexión con el Prospecto
  @IsInt()
  prospectId!: number;

  // Datos del Cliente
  @IsString()
  clientName!: string;

  @IsString()
  clientLastName!: string;

  @IsString()
  phone!: string;

  @IsString()
  address!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  zipCode!: string;

  // Datos de la Venta
  @IsNumber()
  grossAmount!: number;

  @IsNumber()
  netAmount!: number;

  @IsString()
  paymentMethod!: string;

  @IsInt()
  @IsOptional()
  paymentInstallments?: number = 0;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional() @IsString()
  cardHolder?: string;

  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @IsOptional() @IsString()
  cardNumber?: string;

  @IsOptional() @IsString()
  cardExp?: string;

  @IsOptional() @IsString()
  cardCvc?: string;

  // Lista de Productos (Wizard Paso 2)
  @IsArray()
  products!: {
    productName: string;
    quantity: number;
    price: number;
  }[];
}