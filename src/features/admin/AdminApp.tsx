import { useEffect, useState } from 'react';
import { EDITION_ID, getRepo, IS_DEMO, type Repo } from '../../data/repo';
import { onRepoError, reportRepoError } from '../../data/errors';
import { buildAttendance, sameAttendance } from '../../domain/lobby/lobby';
import type { AdminUser } from '../../data/ports';
import { Link } from '../../lib/router';
import { Logo, Totem } from '../../ui/brand';
import { useDocumentTheme } from '../../ui/ThemeScope';
import './admin.css';
import { GroupsPage } from './GroupsPage';
import { LobbyPage } from './LobbyPage';
import { ParticipantsPage } from './ParticipantsPage';
import { QuizPage } from './QuizPage';
import { ResponsesPage } from './ResponsesPage';
import { SettingsPage } from './SettingsPage';
import { useAdminData } from './useAdminData';

const SECTIONS = [
  { id: 'portada', label: 'Portada' },
  { id: 'participants', label: 'Participants' },
  { id: 'grups', label: 'Grups' },
  { id: 'questionari', label: 'Qüestionari' },
  { id: 'respostes', label: 'Respostes' },
  { id: 'configuracio', label: 'Tema i edició' },
] as const;

export default function AdminApp({ path }: { path: string }) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    getRepo().then(setRepo).catch((e) => setLoginError((e as Error).message));
    document.body.classList.add('is-admin');
    return () => document.body.classList.remove('is-admin');
  }, []);
  useEffect(() => (repo ? repo.onAuthChange(setUser) : undefined), [repo]);

  if (loginError && !repo)
    return (
      <main className="screen">
        <div className="screen-inner screen-center">
          <h2>Configuració pendent</h2>
          <p>{loginError}</p>
        </div>
      </main>
    );

  if (!repo || user === undefined)
    return (
      <main className="screen">
        <div className="screen-inner screen-center">
          <div className="spinner" />
        </div>
      </main>
    );

  if (!user)
    return (
      <main className="screen">
        <div className="screen-inner screen-center">
          <Logo size={240} />
          <h2>Zona de l'organitzador</h2>
          <button
            className="btn"
            onClick={() => repo.signIn().catch((e) => setLoginError((e as Error).message))}
          >
            Entrar amb Google
          </button>
          {IS_DEMO && <p className="muted small">Mode demo: entraràs com a admin de prova.</p>}
          {loginError && <p className="error-text">{loginError}</p>}
        </div>
      </main>
    );

  return <AdminShell repo={repo} user={user} path={path} />;
}

function AdminShell({ repo, user, path }: { repo: Repo; user: AdminUser; path: string }) {
  const data = useAdminData(repo, EDITION_ID);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onRepoError(setError), []);

  // Manté sincronitzada la llista pública d'assistència (només noms) amb els participants
  useEffect(() => {
    if (!data.ready || !data.publicEdition) return;
    const attendance = buildAttendance(data.participants);
    if (!sameAttendance(attendance, data.publicEdition.lobby.attendance))
      repo.savePublicEdition(EDITION_ID, { lobby: { ...data.publicEdition.lobby, attendance } }).catch(reportRepoError);
  }, [data.ready, data.participants, data.publicEdition, repo]);
  useDocumentTheme(data.publicEdition?.theme ?? null);

  const section = path.split('/')[2] || 'participants';

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-brand">
          <Totem height={34} />
          {data.edition?.title ?? 'Totem'}
        </div>
        <nav className="admin-nav">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={`/admin/${s.id}`} aria-current={section === s.id ? 'page' : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        <span className="muted small">{user.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => repo.signOut()}>
          Sortir
        </button>
      </header>
      <main className="admin-main">
        {error && (
          <div className="admin-banner" role="alert">
            {error}{' '}
            <button className="link-btn" onClick={() => setError(null)}>
              tancar
            </button>
          </div>
        )}
        {!data.ready ? (
          <div className="spinner" />
        ) : section === 'grups' ? (
          <GroupsPage repo={repo} data={data} />
        ) : section === 'questionari' ? (
          <QuizPage repo={repo} data={data} />
        ) : section === 'respostes' ? (
          <ResponsesPage data={data} />
        ) : section === 'portada' ? (
          <LobbyPage repo={repo} data={data} />
        ) : section === 'configuracio' ? (
          <SettingsPage repo={repo} data={data} />
        ) : (
          <ParticipantsPage repo={repo} data={data} />
        )}
      </main>
    </div>
  );
}
