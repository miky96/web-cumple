import { useState } from 'react';
import { useRemoteDraft } from '../../lib/hooks';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { nightLabel } from '../../data/defaults';
import { derivePalette, normalizeTheme, themeWarnings } from '../../domain/theme/palette';
import type { Theme } from '../../domain/types';
import { Logo } from '../../ui/brand';
import { ThemeScope } from '../../ui/ThemeScope';
import { askConfirm } from '../../ui/confirm';
import type { AdminData } from './useAdminData';

/** Parelles de neons provades (principal, secundari). */
const PRESETS: [string, string][] = [
  ['#ff2e93', '#2ef2ff'],
  ['#b14dff', '#7cff4f'],
  ['#ff8a2e', '#3b7bff'],
  ['#2ef2ff', '#ff2e93'],
  ['#7cff4f', '#ff2e93'],
  ['#ffe94d', '#b14dff'],
  ['#ff3b3b', '#2ef2ff'],
];

function WelcomeMock({ theme }: { theme: Theme }) {
  return (
    <main className="screen">
      <div className="screen-inner welcome">
        <div className="hud">
          <span>1UP 000000</span>
          <span>HI 999990</span>
        </div>
        <Logo size={200} />
        <p className="welcome-hello">Hola, Anna</p>
        <p>El tòtem t'ha triat per a una missió.</p>
        <p className="insert-coin">{theme.subtitle}</p>
        <button className="btn btn-block" type="button">
          Press start
        </button>
        <button className="option" type="button" aria-pressed="true" style={{ marginTop: 12 }}>
          <span className="option-mark">✓</span> Opció triada
        </button>
        <button className="option" type="button" aria-pressed="false">
          <span className="option-mark" /> Opció normal
        </button>
      </div>
    </main>
  );
}

export function SettingsPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useRemoteDraft(
    data.publicEdition?.theme,
    (t): Theme => normalizeTheme(t),
    !dirty && !!data.publicEdition,
  );
  const [nights, setNights] = useRemoteDraft(data.edition?.nights, (n): string[] => n ?? []);
  const [newNight, setNewNight] = useState('');
  const [title, setTitle] = useState(data.edition?.title ?? '');


  const set = (patch: Partial<Theme>) => {
    setTheme((t) => ({ ...t, ...patch }));
    setDirty(true);
  };
  const warnings = themeWarnings(theme);
  const palette = derivePalette(theme.base, theme.accent);

  const saveNights = (next: string[]) => {
    const sorted = [...new Set(next)].sort();
    setNights(sorted);
    repo.updateEdition(EDITION_ID, { nights: sorted });
  };

  return (
    <>
      <h1>Tema i edició</h1>
      <div className="quiz-layout">
        <div className="stack">
          <section className="card">
            <h3>Neons de l'any</h3>
            <div className="swatches" style={{ marginBottom: 12 }}>
              {PRESETS.map(([a, b]) => (
                <button
                  key={a + b}
                  type="button"
                  className="swatch"
                  title={`${a} + ${b}`}
                  style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }}
                  onClick={() => set({ base: a, accent: b })}
                />
              ))}
            </div>
            <div className="two-col">
              <label className="field">
                <span>Neó principal (botons, títols)</span>
                <div className="row">
                  <input type="color" value={theme.base} onChange={(e) => set({ base: e.target.value })} />
                  <input className="input" style={{ flex: 1 }} value={theme.base} onChange={(e) => set({ base: e.target.value })} />
                </div>
              </label>
              <label className="field">
                <span>Neó secundari (vores, tòtem, graella)</span>
                <div className="row">
                  <input type="color" value={theme.accent ?? palette.accent} onChange={(e) => set({ accent: e.target.value })} />
                  {theme.accent && (
                    <button className="link-btn" onClick={() => set({ accent: null })}>
                      automàtic
                    </button>
                  )}
                </div>
              </label>
            </div>
            <div className="swatches" style={{ marginBottom: 12 }}>
              {(['primary', 'accent', 'score', 'horizon', 'bg'] as const).map((k) => (
                <div key={k} className="swatch" style={{ background: palette[k], color: k === 'horizon' || k === 'bg' ? palette.ink : palette.bg }}>
                  {k}
                </div>
              ))}
            </div>
            <div className="two-col">
              <label className="field">
                <span>Fons</span>
                <select className="select" value={theme.pattern} onChange={(e) => set({ pattern: e.target.value as Theme['pattern'] })}>
                  <option value="grid">Graella de neó</option>
                  <option value="none">Només horitzó</option>
                </select>
              </label>
              <label className="field">
                <span>Intensitat de la graella ({Math.round(theme.patternOpacity * 100)}%)</span>
                <input className="range" type="range" min={0} max={1} step={0.05} value={theme.patternOpacity} onChange={(e) => set({ patternOpacity: Number(e.target.value) })} />
              </label>
            </div>
            <label className="field">
              <span>Fons de la pantalla de resultat (opcional)</span>
              <input
                className="input"
                value={theme.resultBackground ?? ''}
                placeholder="/editions/2027/fons.webp — deixa-ho buit per fer servir el color del grup"
                onChange={(e) => set({ resultBackground: e.target.value.trim() || null })}
              />
              <span className="muted small">Cada grup pot tenir el seu propi fons a la pestanya Grups (té prioritat sobre aquest).</span>
            </label>
            <label className="field">
              <span>Subtítol (portada i resultat)</span>
              <input className="input" value={theme.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Ens veiem el 22 de gener!" />
            </label>
            {warnings.map((w) => (
              <p key={w.code} className="error-text">
                ⚠️ {w.message}
              </p>
            ))}
            <button
              className="btn btn-sm"
              disabled={!dirty}
              onClick={async () => {
                await repo.savePublicEdition(EDITION_ID, { theme });
                setDirty(false);
              }}
            >
              {dirty ? 'Desar tema' : 'Desat ✓'}
            </button>
          </section>

          <section className="card">
            <h3>Edició {EDITION_ID}</h3>
            <label className="field">
              <span>Nom intern</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && repo.updateEdition(EDITION_ID, { title: title.trim() })} />
            </label>
            <span style={{ fontWeight: 700 }}>Nits</span>
            <div className="row" style={{ margin: '8px 0' }}>
              {nights.map((n) => (
                <span key={n} className="chip">
                  {nightLabel(n)}
                  <button className="link-btn" title="Treure" onClick={async () =>
                      (await askConfirm({ title: 'TREURE NIT?', message: `Treure la nit ${nightLabel(n)} de l'edició?`, confirmLabel: 'Treure', danger: true })) &&
                      saveNights(nights.filter((x) => x !== n))
                    }>
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="row">
              <input className="input" type="date" style={{ maxWidth: 200, minHeight: 38 }} value={newNight} onChange={(e) => setNewNight(e.target.value)} />
              <button
                className="btn btn-ghost btn-sm"
                disabled={!newNight}
                onClick={() => {
                  saveNights([...nights, newNight]);
                  setNewNight('');
                }}
              >
                + Afegir nit
              </button>
            </div>
            <p className="muted small">
              Les persones noves s'afegeixen amb totes les nits marcades. Les que ja hi són no canvien.
            </p>
            <label className="row" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={data.publicEdition?.allowRetake ?? true}
                onChange={(e) => repo.savePublicEdition(EDITION_ID, { allowRetake: e.target.checked })}
              />
              Permetre tornar a fer el qüestionari (substitueix les respostes anteriors)
            </label>
          </section>
        </div>
        <div className="phone">
          <ThemeScope theme={theme}>
            <WelcomeMock theme={theme} />
          </ThemeScope>
        </div>
      </div>
    </>
  );
}
