import { IsObject, IsString, Matches } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  @Matches(/\S/)
  name!: string;

  @IsString()
  @Matches(/\S/)
  type!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
