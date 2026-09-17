# Email module

Renders Handlebars templates and sends them through one configurable provider.
Callers see `EmailService` and nothing else — the provider is private to this
module, which is what lets it be swapped by configuration or removed entirely at
project generation.

For the provider design, the trade-offs of each one, and how to add another, see
[`docs/architecture/integrations/email-providers.md`](../../../docs/architecture/integrations/email-providers.md).

## Sending

```typescript
import { EmailService } from 'src/modules/email/services/email-service';

constructor(private readonly emailService: EmailService) {}

await this.emailService.sendEmail(
  'recipient@example.com',
  'Email Subject',
  '<h1>Hello World</h1>', // HTML body
  'Hello World',          // optional plain-text body
);
```

| Parameter  | Required | Meaning                  |
| ---------- | -------- | ------------------------ |
| `to`       | yes      | Recipient address        |
| `subject`  | yes      | Subject line             |
| `bodyHtml` | no       | HTML body, defaults `''` |
| `bodyText` | no       | Plain-text alternative   |

Attachments are not supported. Nothing in this codebase sends one, and SES
cannot carry them through `SendEmailCommand` — adding them means picking a
provider that can and widening `SendEmailOptions`.

## Templates

```typescript
import { ITemplates } from 'src/modules/email/types/templates.type';

// loadTemplate is async — it resolves the brand logo before compiling.
const html = await this.emailService.loadTemplate(ITemplates.OTP, {
  otp: '123456',
  userName: 'John Doe',
});

await this.emailService.sendEmail(to, 'Your OTP Code', html);
```

Available: `ITemplates.OTP`, `ITemplates.FORGOT_PASSWORD`, `ITemplates.NEW_USER`.
The `.hbs` files live in `src/email-templates/` (override with `TEMPLATES_PATH`).

Every template is given the brand values from
`constants/email-brand.constant.ts` — `appName`, `supportEmail`, the palette,
`currentYear` — plus a resolved `logoSrc`. The logo is resolved in order:
`EMAIL_LOGO_URL` if set, else the local file uploaded to S3 once per process,
else a `data:` URI as a last resort. Gmail and most clients block `data:` image
URLs, so a real HTTPS URL is worth configuring.

## Configuration

`EMAIL_PROVIDER` selects the implementation. An unknown value — including one
naming a provider this build was generated without — stops the app at boot, in
`utils/email-env.validation.ts`, rather than failing at the first send.

| Variable            | Meaning                                         |
| ------------------- | ----------------------------------------------- |
| `EMAIL_PROVIDER`    | Which provider sends. Defaults to the one kept. |
| `EMAIL_SENDER`      | The shared from-address.                        |
| `EMAIL_SENDER_NAME` | Display name; falls back to the brand name.     |
| `EMAIL_LOGO_URL`    | Public HTTPS logo. Optional.                    |

Each provider adds its own keys — an API key, sometimes a sender override.
Rather than list providers this project may not have, read `.env.example`: it
contains exactly the keys this build needs, and nothing else. The full
per-provider table lives in the architecture doc linked above.
