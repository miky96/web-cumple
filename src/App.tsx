import { lazy, Suspense } from 'react';
import { HomePage } from './features/public/HomePage';
import { ParticipantPage } from './features/public/ParticipantPage';
import { matchPath, usePath } from './lib/router';
import { DialogHost } from './ui/confirm';

// L'admin es carrega a part: els participants no descarreguen aquest codi.
const AdminApp = lazy(() => import('./features/admin/AdminApp'));

export function App() {
  return (
    <>
      <Routes />
      <DialogHost />
    </>
  );
}

function Routes() {
  const path = usePath();

  const participant = matchPath('/p/:token', path);
  if (participant)
    return (
      <>
        <div className="grid-floor" aria-hidden />
        <ParticipantPage key={participant.token} token={participant.token} />
      </>
    );

  if (path === '/admin' || path.startsWith('/admin/'))
    return (
      <Suspense fallback={<div className="screen"><div className="spinner" /></div>}>
        <AdminApp path={path} />
      </Suspense>
    );

  // `/` i `/portada`: pàgina compartida (compte enrere + assistència)
  return (
    <>
      <div className="grid-floor" aria-hidden />
      <HomePage />
    </>
  );
}
