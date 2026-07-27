import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateCommentContactsDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;

  @IsInt()
  @IsNotEmpty()
  ContactId!: number;
}

export class UpdateCommentContactsDto {
  @IsString()
  @IsOptional()
  comment?: string;
}