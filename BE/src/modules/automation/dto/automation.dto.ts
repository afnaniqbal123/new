import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AUTOMATION_KIND } from 'src/modules/automation/constants/automation.constant';

export class TriggerAutomationDto {
  @ApiProperty({
    enum: AUTOMATION_KIND,
    example: AUTOMATION_KIND.MORNING_DIGEST,
  })
  @IsEnum(AUTOMATION_KIND)
  kind: AUTOMATION_KIND;
}

export class LatestRunQueryDto {
  @ApiProperty({
    enum: AUTOMATION_KIND,
    example: AUTOMATION_KIND.MORNING_DIGEST,
  })
  @IsEnum(AUTOMATION_KIND)
  kind: AUTOMATION_KIND;
}
