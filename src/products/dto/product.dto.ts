import { IsString, IsInt, IsNumber, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsInt()
  @IsNotEmpty()
  stock!: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsNotEmpty()
  status!: boolean;
}

export class UpdateProductDto {
  @IsString() @IsOptional()
  sku?: string;

  @IsInt() @IsOptional()
  stock?: number;

  @IsNumber() @IsOptional()
  price?: number;

  @IsBoolean() @IsOptional()
  status?: boolean;
}