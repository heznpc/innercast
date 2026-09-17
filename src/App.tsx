import { useEffect, useState } from "react";
import { LandingPage } from "./landing/LandingPage";
import type { Locale } from "./landing/copy";
import { Workspace } from "./workspace/Workspace";

export function App() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="site-shell">
      <LandingPage locale={locale} setLocale={setLocale} />
      <Workspace />
    </div>
  );
}
