import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean;
}