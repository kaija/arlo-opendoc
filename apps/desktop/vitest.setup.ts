// Initialise the renderer's i18next singleton before any test renders a
// component. Components call useTranslation() unconditionally; without this the
// hook falls back to echoing keys and text assertions fail. Defaults to English.
import './src/renderer/src/i18n';
