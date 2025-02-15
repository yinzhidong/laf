import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsNotEmpty, IsString, Length } from 'class-validator'
import { ApplicationState } from '../entities/application'

const STATES = [
  ApplicationState.Running,
  ApplicationState.Stopped,
  ApplicationState.Restarting,
]

/**
 * @deprecated use UpdateApplicationNameDto or UpdateApplicationStateDto instead
 */
export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsString()
  @Length(1, 64)
  name?: string

  @ApiPropertyOptional({
    enum: ApplicationState,
  })
  @IsIn(STATES)
  state?: ApplicationState

  validate() {
    return null
  }
}

export class UpdateApplicationNameDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  @IsNotEmpty()
  name: string
}

export class UpdateApplicationStateDto {
  @ApiProperty({ enum: ApplicationState })
  @IsIn(STATES)
  @IsNotEmpty()
  state: ApplicationState
}

export class UpdateApplicationBundleDto {
  // build resources
  @ApiProperty({ example: 200 })
  @IsNotEmpty()
  @IsInt()
  cpu: number

  @ApiProperty({ example: 256 })
  @IsNotEmpty()
  @IsInt()
  memory: number

  @ApiProperty({ example: 2048 })
  @IsNotEmpty()
  @IsInt()
  databaseCapacity: number

  @ApiProperty({ example: 4096 })
  @IsNotEmpty()
  @IsInt()
  storageCapacity: number
}
