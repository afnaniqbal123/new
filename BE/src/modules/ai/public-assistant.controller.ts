import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { ProductAssistantService } from 'src/modules/ai/product-assistant.service';
import { AskAssistantDto } from 'src/modules/ai/dto/ai.dto';
import { AI_RESPONSE } from 'src/modules/ai/constants/api-response/ai.response';
import { SerializeHttpResponse } from 'src/utils/serializer';

/**
 * The assistant on the marketing page — deliberately unauthenticated.
 *
 * Separate from `AiController` rather than a `@Public()` route inside it: that
 * controller carries `OrganizationAccessGuard` and `PermissionsGuard` at the
 * class level, and a public route living among tenant-scoped ones is the kind
 * of arrangement that leaks the first time somebody reorders a decorator.
 * Keeping it in its own file makes "this endpoint has no auth" a property of
 * the file, visible at a glance.
 *
 * Nothing here touches tenant data. `ProductAssistantService` answers from a
 * fixed knowledge base about the product and has no access to a repository —
 * see that service for why that is what makes this safe to expose.
 */
@Controller('assistant')
@ApiTags('Product assistant')
export class PublicAssistantController {
  constructor(private readonly assistant: ProductAssistantService) {}

  /** Lets the widget show whether answers will be model-written or curated. */
  @Public()
  @Get('status')
  status() {
    return SerializeHttpResponse(
      {
        configured: this.assistant.isConfigured(),
        suggestions: this.assistant.suggestions,
      },
      200,
      AI_RESPONSE.STATUS_FETCHED,
    );
  }

  @Public()
  @Post('ask')
  async ask(@Body() dto: AskAssistantDto) {
    const result = await this.assistant.answer(dto.question);

    return SerializeHttpResponse(result, 200, AI_RESPONSE.ANSWERED);
  }
}
