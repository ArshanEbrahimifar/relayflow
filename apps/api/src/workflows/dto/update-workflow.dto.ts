import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, {
    message: 'name must contain at least one non-whitespace character',
  })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  definition?: object;
}
