/**
 * Tests de seguretat de Firestore. S'executen amb l'emulador:
 *   npm run test:rules   (necessita Java instal·lat)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
const ADMIN_EMAIL = /email in \['([^']+)'/.exec(rules)![1];

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA'; // reclamat per l'Anna
const OTHER = 'BBBBBBBBBBBBBBBBBBBBBB'; // reclamat pel Bernat
const FREE = 'CCCCCCCCCCCCCCCCCCCCCC'; // encara sense reclamar
const EDITION = '2027';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-totem',
    // host/port: els agafa de FIRESTORE_EMULATOR_HOST, que defineix `firebase emulators:exec`
    firestore: { rules },
  });
});

afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'publicEditions', EDITION), { title: 'T', theme: {}, quizSteps: [], lobby: { surveyOpen: true } });
    await setDoc(doc(db, 'editions', EDITION), { title: 'T' });
    await setDoc(doc(db, 'editions', EDITION, 'participants', 'p1'), { name: 'Anna', token: TOKEN, groupId: 'g1' });
    await setDoc(doc(db, 'editions', EDITION, 'groups', 'g1'), { name: 'Tribu Volcà' });
    const owners: Record<string, string | null> = { [TOKEN]: 'u-anna', [OTHER]: 'u-bernat', [FREE]: null };
    for (const [t, uid] of Object.entries(owners)) {
      await setDoc(doc(db, 'invites', t), uid ? { editionId: EDITION, displayName: t, uid } : { editionId: EDITION, displayName: t });
      if (uid) await setDoc(doc(db, 'accounts', uid), { token: t, editionId: EDITION, email: `${uid}@gmail.com`, claimedAt: new Date() });
      await setDoc(doc(db, 'reveals', t), { editionId: EDITION, groupName: 'Tribu Volcà', color: '#f00', image: null, selfKey: `k_${t}`, mateKeys: [] });
    }
    await setDoc(doc(db, 'responses', OTHER), { editionId: EDITION, answers: {}, completedAt: new Date() });
    await setDoc(doc(db, 'contacts', OTHER), { editionId: EDITION, email: 'bernat@gmail.com' });
    await setDoc(doc(db, 'mateStatus', 'k_nou'), { editionId: EDITION, answeredAt: null });
    await setDoc(doc(db, 'mateCards', 'k_nou'), { editionId: EDITION, name: 'Anna' });
    await setDoc(doc(db, 'mateStatus', 'k_fet'), { editionId: EDITION, answeredAt: new Date() });
    await setDoc(doc(db, 'mateCards', 'k_fet'), { editionId: EDITION, name: 'Bernat' });
  });
});

const user = (uid: string, email = `${uid}@gmail.com`) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const anna = () => user('u-anna');
const bernat = () => user('u-bernat');
const newbie = () => user('u-nou');
const admin = () => env.authenticatedContext('admin', { email: ADMIN_EMAIL, email_verified: true }).firestore();
const stranger = () => user('x', 'algu@gmail.com');

const validResponse = () => ({ editionId: EDITION, answers: { s1: 'hola' }, completedAt: serverTimestamp() });

/** Reclamar un enllaç com fa l'app: invitació + accounts/{uid} en el mateix lot. */
type Db = ReturnType<typeof anon>;
/** L'emulador retorna el Firestore "compat": el convertim per a `writeBatch`. */
const batchOf = (db: Db) => writeBatch(db as unknown as Parameters<typeof writeBatch>[0]);

const claim = (db: Db, uid: string, token: string, email = `${uid}@gmail.com`) => {
  const b = batchOf(db);
  b.update(doc(db, 'invites', token), { uid });
  b.set(doc(db, 'accounts', uid), { token, editionId: EDITION, email, claimedAt: serverTimestamp() });
  return b.commit();
};

describe('sense compte (només amb l’enllaç)', () => {
  it('pot llegir la configuració pública i la invitació (per saber a qui saludar)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'publicEditions', EDITION)));
    await assertSucceeds(getDoc(doc(anon(), 'invites', TOKEN)));
  });

  it('NO pot llegir ni escriure la resposta, la revelació ni el correu, encara que tingui l’enllaç', async () => {
    await assertFails(getDoc(doc(anon(), 'responses', OTHER)));
    await assertFails(getDoc(doc(anon(), 'reveals', OTHER)));
    await assertFails(getDoc(doc(anon(), 'contacts', OTHER)));
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), validResponse()));
    await assertFails(setDoc(doc(anon(), 'responses', FREE), validResponse()));
  });

  it('NO pot reclamar enllaços', async () => {
    await assertFails(updateDoc(doc(anon(), 'invites', FREE), { uid: 'hack' }));
  });

  it('NO pot llistar invitacions, respostes, revelacions, comptes ni contactes', async () => {
    for (const col of ['invites', 'responses', 'reveals', 'accounts', 'contacts']) await assertFails(getDocs(collection(anon(), col)));
  });

  it('NO pot llegir assignacions ni dades d’admin', async () => {
    await assertFails(getDoc(doc(anon(), 'editions', EDITION, 'participants', 'p1')));
    await assertFails(getDoc(doc(anon(), 'editions', EDITION, 'groups', 'g1')));
    await assertFails(getDoc(doc(anon(), 'editions', EDITION)));
  });

  it('NO pot llegir ni escriure res dels diners', async () => {
    for (const col of ['payments', 'expenses', 'budgetLines', 'adjustments']) {
      await assertFails(getDocs(collection(anon(), 'editions', EDITION, col)));
      await assertFails(setDoc(doc(anon(), 'editions', EDITION, col, 'x'), { amount: 1 }));
      await assertFails(getDocs(collection(stranger(), 'editions', EDITION, col)));
    }
    await assertFails(getDoc(doc(anon(), 'editions', EDITION, 'money', 'pricing')));
  });

  it('NO pot veure qui ha contestat', async () => {
    await assertFails(getDoc(doc(anon(), 'mateStatus', 'k_fet')));
    await assertFails(getDoc(doc(anon(), 'mateCards', 'k_fet')));
  });
});

describe('reclamar l’enllaç', () => {
  it('un compte nou reclama un enllaç lliure i llavors hi pot jugar', async () => {
    await assertSucceeds(claim(newbie(), 'u-nou', FREE));
    await assertSucceeds(getDoc(doc(newbie(), 'accounts', 'u-nou')));
    await assertSucceeds(setDoc(doc(newbie(), 'responses', FREE), validResponse()));
    await assertSucceeds(getDoc(doc(newbie(), 'reveals', FREE)));
  });

  it('NO es pot reclamar un enllaç que ja és d’un altre', async () => {
    await assertFails(claim(newbie(), 'u-nou', TOKEN));
  });

  it('NO es pot tenir dos enllaços de la mateixa edició amb un compte', async () => {
    await assertFails(claim(anna(), 'u-anna', FREE));
  });

  it('cal escriure invitació i compte junts, amb el teu uid i el teu correu', async () => {
    await assertFails(updateDoc(doc(newbie(), 'invites', FREE), { uid: 'u-nou' }));
    await assertFails(setDoc(doc(newbie(), 'accounts', 'u-nou'), { token: FREE, editionId: EDITION, email: 'u-nou@gmail.com', claimedAt: serverTimestamp() }));
    await assertFails(claim(newbie(), 'u-anna', FREE));
    await assertFails(claim(newbie(), 'u-nou', FREE, 'un-altre@gmail.com'));
  });

  it('NO es pot canviar res més de la invitació', async () => {
    const db = newbie();
    const b = batchOf(db);
    b.update(doc(db, 'invites', FREE), { uid: 'u-nou', displayName: 'Hack' });
    b.set(doc(db, 'accounts', 'u-nou'), { token: FREE, editionId: EDITION, email: 'u-nou@gmail.com', claimedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NO es pot llegir el compte d’un altre', async () => {
    await assertFails(getDoc(doc(newbie(), 'accounts', 'u-anna')));
  });
});

describe('propietari de l’enllaç', () => {
  it('NO pot veure la revelació abans de respondre', async () => {
    await assertFails(getDoc(doc(anna(), 'reveals', TOKEN)));
  });

  it('pot respondre i llavors veure la revelació', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(getDoc(doc(anna(), 'responses', TOKEN)));
    await assertSucceeds(getDoc(doc(anna(), 'reveals', TOKEN)));
  });

  it('NO pot llegir ni escriure les dades d’un altre participant', async () => {
    await assertFails(getDoc(doc(anna(), 'responses', OTHER)));
    await assertFails(getDoc(doc(anna(), 'reveals', OTHER)));
    await assertFails(getDoc(doc(anna(), 'contacts', OTHER)));
    await assertFails(setDoc(doc(anna(), 'responses', OTHER), validResponse()));
    await assertFails(setDoc(doc(anna(), 'contacts', OTHER), { editionId: EDITION, email: 'hack@x.cat' }));
  });

  it('pot desar i llegir el seu correu, però només amb un format vàlid', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'contacts', TOKEN), { editionId: EDITION, email: 'anna@gmail.com' }));
    await assertSucceeds(getDoc(doc(anna(), 'contacts', TOKEN)));
    await assertFails(setDoc(doc(anna(), 'contacts', TOKEN), { editionId: EDITION, email: 'no-es-un-mail' }));
    await assertFails(setDoc(doc(anna(), 'contacts', TOKEN), { editionId: EDITION, email: 'a@b.cat', extra: 1 }));
    await assertFails(setDoc(doc(anna(), 'contacts', TOKEN), { editionId: '2099', email: 'a@b.cat' }));
    await assertFails(getDocs(collection(anna(), 'contacts')));
  });

  it('pot tornar a fer el qüestionari (substitueix la resposta) però amb les mateixes validacions', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), answers: { s1: 'adeu' } }));
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), groupId: 'g1' }));
  });

  it('NO pot tornar a jugar si l’admin ho ha desactivat', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicEditions', EDITION), { title: 'T', allowRetake: false, lobby: { surveyOpen: true } });
    });
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), answers: { s1: 'adeu' } }));
  });

  it('NO pot respondre amb un token inexistent', async () => {
    await assertFails(setDoc(doc(anna(), 'responses', 'DDDDDDDDDDDDDDDDDDDDDD'), validResponse()));
  });

  it('NO pot falsejar camps, edició ni data', async () => {
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), groupId: 'g1' }));
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), editionId: '2099' }));
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), { ...validResponse(), completedAt: new Date(0) }));
  });

  it('NO pot respondre mentre l’enquesta és tancada (portada amb compte enrere)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicEditions', EDITION), { title: 'T', lobby: { surveyOpen: false } });
    });
    await assertFails(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
  });

  it('pot escoltar la configuració pública (portada en temps real)', async () => {
    await assertSucceeds(getDoc(doc(anna(), 'publicEditions', EDITION)));
    await assertFails(getDocs(collection(anna(), 'publicEditions')));
  });

  it('NO pot desvincular-se, esborrar ni escriure revelacions', async () => {
    await assertFails(updateDoc(doc(anna(), 'invites', TOKEN), { uid: 'u-nou' }));
    await assertFails(deleteDoc(doc(bernat(), 'responses', OTHER)));
    await assertFails(setDoc(doc(anna(), 'reveals', TOKEN), { groupName: 'Hack' }));
  });
});

describe('sala arcade', () => {
  const board = { scores: { 'tap-race': { answer: { taps: 40, durationMs: 5000 }, score: -40, at: 1 } } };

  it('el propietari hi pot desar marques un cop fet el qüestionari', async () => {
    await assertFails(setDoc(doc(anna(), 'arcade', TOKEN), { editionId: EDITION, ...board }));
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(setDoc(doc(anna(), 'arcade', TOKEN), { editionId: EDITION, ...board }));
    await assertSucceeds(getDoc(doc(anna(), 'arcade', TOKEN)));
  });

  it('NO s’hi poden posar jocs inventats, camps extra ni una altra edició', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertFails(setDoc(doc(anna(), 'arcade', TOKEN), { editionId: EDITION, scores: { hack: {} } }));
    await assertFails(setDoc(doc(anna(), 'arcade', TOKEN), { editionId: EDITION, ...board, extra: 1 }));
    await assertFails(setDoc(doc(anna(), 'arcade', TOKEN), { editionId: '2099', ...board }));
  });

  it('ningú més hi pot llegir ni escriure', async () => {
    await assertFails(setDoc(doc(anna(), 'arcade', OTHER), { editionId: EDITION, ...board }));
    await assertFails(getDoc(doc(anon(), 'arcade', OTHER)));
    await assertFails(getDocs(collection(anna(), 'arcade')));
  });
});

describe('leaderboard', () => {
  const scores = { 'tap-race': { answer: { taps: 40, durationMs: 5000 }, score: -40, at: 1 } };

  it('el propietari hi publica les seves marques amb el nom de la invitació, un cop fet el qüestionari', async () => {
    await assertFails(setDoc(doc(anna(), 'leaderboard', 'u-anna'), { editionId: EDITION, name: TOKEN, scores }));
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(setDoc(doc(anna(), 'leaderboard', 'u-anna'), { editionId: EDITION, name: TOKEN, scores }));
  });

  it('NO es pot canviar el nom, publicar per un altre ni posar jocs inventats', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'responses', TOKEN), validResponse()));
    await assertFails(setDoc(doc(anna(), 'leaderboard', 'u-anna'), { editionId: EDITION, name: 'La reina', scores }));
    await assertFails(setDoc(doc(anna(), 'leaderboard', 'u-bernat'), { editionId: EDITION, name: OTHER, scores }));
    await assertFails(setDoc(doc(anna(), 'leaderboard', 'u-anna'), { editionId: EDITION, name: TOKEN, scores: { hack: {} } }));
  });

  it('el poden llegir els comptes amb enllaç, però no els anònims ni comptes sense enllaç', async () => {
    await assertSucceeds(getDocs(collection(anna(), 'leaderboard')));
    await assertFails(getDocs(collection(anon(), 'leaderboard')));
    await assertFails(getDocs(collection(newbie(), 'leaderboard')));
  });
});

describe('companys que han contestat', () => {
  it('es pot saber si un company ha contestat, però NO el seu nom fins que ho fa', async () => {
    await assertSucceeds(getDoc(doc(anna(), 'mateStatus', 'k_nou')));
    await assertFails(getDoc(doc(anna(), 'mateCards', 'k_nou')));
    await assertSucceeds(getDoc(doc(anna(), 'mateCards', 'k_fet')));
  });

  it('NO es poden llistar', async () => {
    await assertFails(getDocs(collection(anna(), 'mateStatus')));
    await assertFails(getDocs(collection(anna(), 'mateCards')));
  });

  it('es marca com a contestat un sol cop, amb l’hora del servidor, i llavors es veu el nom', async () => {
    await assertFails(updateDoc(doc(anna(), 'mateStatus', 'k_nou'), { answeredAt: new Date(0) }));
    await assertSucceeds(updateDoc(doc(anna(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(anna(), 'mateCards', 'k_nou')));
    await assertFails(updateDoc(doc(anna(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp() }));
  });

  it('NO es poden crear, desmarcar, ni tocar altres camps o els noms', async () => {
    await assertFails(setDoc(doc(anna(), 'mateStatus', 'k_inventat'), { editionId: EDITION, answeredAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(anna(), 'mateStatus', 'k_fet'), { answeredAt: null }));
    await assertFails(updateDoc(doc(anna(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp(), editionId: '2099' }));
    await assertFails(setDoc(doc(anna(), 'mateCards', 'k_fet'), { editionId: EDITION, name: 'Hack' }));
    await assertFails(deleteDoc(doc(anna(), 'mateStatus', 'k_fet')));
  });
});

describe('usuari autenticat que no és admin', () => {
  it('no pot llegir dades d’admin ni d’enllaços que no són seus', async () => {
    await assertFails(getDoc(doc(stranger(), 'editions', EDITION, 'participants', 'p1')));
    await assertFails(getDocs(collection(stranger(), 'responses')));
    await assertFails(getDoc(doc(stranger(), 'responses', OTHER)));
    await assertFails(getDoc(doc(stranger(), 'contacts', OTHER)));
  });
});

describe('admin', () => {
  it('pot llegir i escriure-ho tot', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'editions', EDITION, 'participants')));
    await assertSucceeds(getDocs(collection(admin(), 'responses')));
    await assertSucceeds(setDoc(doc(admin(), 'reveals', TOKEN), { groupName: 'X' }));
    await assertSucceeds(deleteDoc(doc(admin(), 'responses', OTHER)));
    await assertSucceeds(getDocs(collection(admin(), 'contacts')));
    await assertSucceeds(getDocs(collection(admin(), 'accounts')));
    await assertSucceeds(updateDoc(doc(admin(), 'invites', TOKEN), { uid: null }));
  });

  it('cal que l’email estigui verificat', async () => {
    const unverified = env.authenticatedContext('a', { email: ADMIN_EMAIL, email_verified: false }).firestore();
    await assertFails(getDocs(collection(unverified, 'responses')));
  });
});
