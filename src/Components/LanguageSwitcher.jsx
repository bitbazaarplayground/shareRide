import i18n from "i18next";

function LanguageSwitcher() {
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <select
      className="language-select"
      onChange={(e) => changeLanguage(e.target.value)}
      defaultValue={i18n.language}
    >
      <option value="en">🇬🇧</option>
      <option value="es">🇪🇸</option>
      <option value="fr">🇫🇷</option>
    </select>
  );
}

export default LanguageSwitcher;
