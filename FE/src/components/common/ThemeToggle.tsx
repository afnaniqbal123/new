import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common/Button';
import { Icon, type IconName } from 'src/components/common/Icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'src/components/common/DropdownMenu';
import { useThemeStore, type Theme } from 'src/stores/themeStore';

/**
 * Light/dark/system picker — persisted via `themeStore`, applied by
 * `useThemeSync`.
 *
 * The trigger shows the current mode as an icon rather than as its name. The
 * word "System" sitting in a header beside "Sign in" reads as a navigation
 * item rather than as a control, which is exactly how it looked on the landing
 * page. The name is still what assistive technology announces, via the
 * trigger's `aria-label` and the menu items themselves.
 */
export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { t } = useTranslation();
  const THEME_ICONS: Record<Theme, IconName> = {
    light: 'sun',
    dark: 'moon',
    system: 'monitor',
  };
  const THEME_LABELS: Record<Theme, string> = {
    light: t('THEME_LIGHT'),
    dark: t('THEME_DARK'),
    system: t('THEME_SYSTEM'),
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          className="inline-flex items-center justify-center"
          aria-label={`${t('LABEL_THEME_TOGGLE')}: ${THEME_LABELS[theme]}`}
        >
          <Icon name={THEME_ICONS[theme]} className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            setTheme(value as Theme);
          }}
        >
          {(Object.keys(THEME_LABELS) as Theme[]).map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {THEME_LABELS[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
