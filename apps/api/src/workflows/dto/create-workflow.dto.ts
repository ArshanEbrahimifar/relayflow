import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsObject()
  definition: object;
}
