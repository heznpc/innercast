import { Languages, Sparkles } from "lucide-react";
import { landingCopy, localeLabels, type Locale } from "./copy";

export function LandingPage({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const copy = landingCopy[locale];

  return (
    <section className="landing" id="top">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Innercast home">
          <span className="landing-mark">
            <Sparkles size={22} />
          </span>
          <span>Innercast</span>
        </a>
        <nav aria-label="Landing navigation">
          <a href="#personas">{copy.nav[0]}</a>
          <a href="#flow">{copy.nav[1]}</a>
          <a href="#playground">{copy.nav[2]}</a>
        </nav>
        <div className="locale-switch" aria-label="Language selector">
          <Languages size={16} />
          {(Object.keys(localeLabels) as Locale[]).map((item) => (
            <button key={item} className={item === locale ? "active" : ""} onClick={() => setLocale(item)}>
              {localeLabels[item]}
            </button>
          ))}
        </div>
      </header>

      <div className="landing-hero">
        <div className="hero-copy">
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroText}</p>
          <div className="hero-actions">
            <a className="hero-primary" href="#playground">
              {copy.ctaPrimary}
            </a>
            <a className="hero-secondary" href="./innercast-kit.zip" download>
              {copy.ctaSecondary}
            </a>
          </div>
          <div className="proof-strip">
            {copy.proof.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="cast-stage" id="personas" aria-label={copy.rolesTitle}>
          <div className="stage-header">
            <span>{copy.rolesTitle}</span>
            <strong>Advisory voices → main agent decides</strong>
          </div>
          <div className="persona-grid">
            {copy.roles.map((role) => (
              <article key={role.name} className={`persona-card ${role.name.toLowerCase()}`}>
                <h2>{role.name}</h2>
                <span>{role.role}</span>
                <p>{role.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-flow" id="flow">
        <div>
          <h2>{copy.flowTitle}</h2>
          <p>{copy.boundary}</p>
        </div>
        <ol>
          {copy.flow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="landing-boundary">
        <strong>{copy.boundaryTitle}</strong>
        <span>{copy.boundary}</span>
      </div>
    </section>
  );
}
