import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import {
  REPORT_KIND,
  REPORT_PERIOD,
} from 'src/modules/reports/constants/reports.constant';

export class RunReportQueryDto {
  @ApiProperty({ enum: REPORT_KIND, example: REPORT_KIND.SALES_SUMMARY })
  @IsEnum(REPORT_KIND)
  kind: REPORT_KIND;

  @ApiProperty({
    required: false,
    enum: REPORT_PERIOD,
    example: REPORT_PERIOD.THIS_MONTH,
    description:
      'Resolved server-side in the organization timezone, so "today" means the same thing everywhere.',
  })
  @IsOptional()
  @IsEnum(REPORT_PERIOD)
  period?: REPORT_PERIOD;

  @ApiProperty({ required: false, description: 'Only with period=CUSTOM' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'Only with period=CUSTOM' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
