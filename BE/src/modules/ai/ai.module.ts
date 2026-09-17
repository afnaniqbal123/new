import { Module } from '@nestjs/common';
import { ClerkService } from 'src/modules/ai/clerk.service';
import { AiController } from 'src/modules/ai/ai.controller';
import { PublicAssistantController } from 'src/modules/ai/public-assistant.controller';
import { ProductAssistantService } from 'src/modules/ai/product-assistant.service';
import { GeminiProvider } from 'src/modules/ai/providers/gemini.provider';
import { AI_PROVIDER } from 'src/modules/ai/ai-provider.interface';
import { AiPolicy } from 'src/modules/ai/policies/ai.policy';
import { ReportsModule } from 'src/modules/reports/reports.module';
import { CatalogModule } from 'src/modules/catalog/catalog.module';
import { OrganizationModule } from 'src/modules/organization/organization.module';
import { AuthModule } from 'src/modules/auth/auth.module';

/**
 * The AI Business Clerk.
 *
 * The provider is bound behind the `AI_PROVIDER` token rather than injected
 * concretely, so swapping Gemini for another model is a change to this one
 * line. Nothing above `ClerkService` knows which model is in use — and
 * nothing below it is allowed to produce a number. See `ClerkService` for the
 * full division of labour.
 */
@Module({
  imports: [ReportsModule, CatalogModule, OrganizationModule, AuthModule],
  controllers: [AiController, PublicAssistantController],
  providers: [
    ClerkService,
    ProductAssistantService,
    AiPolicy,
    GeminiProvider,
    { provide: AI_PROVIDER, useExisting: GeminiProvider },
  ],
  exports: [ClerkService],
})
export class AiModule {}
