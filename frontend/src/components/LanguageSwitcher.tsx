import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];

  return (
    <select
      aria-label={t('common.language')}
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      style={{
        width: 'auto',
        padding: '6px 10px',
        fontSize: 13,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
