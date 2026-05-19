import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;

  @IsInt()
  @IsNotEmpty()
  prospectsId!: number;
}

export class UpdateCommentDto {
  @IsString()
  @IsOptional()
  comment?: string;
}