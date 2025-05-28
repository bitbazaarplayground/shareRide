import { useTranslation } from "react-i18next";
import "./StylesPages/Homepage.css";

export default function Homepage() {
  const { t } = useTranslation();

  return (
    <>
      <main className="homepage">
        <h1>{t("welcome")} Share Ride</h1>
        {/* Add more homepage content here */}
      </main>
    </>
  );
}
