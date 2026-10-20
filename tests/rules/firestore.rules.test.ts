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
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
const ADMIN_EMAIL = /email in \['([^']+)'/.exec(rules)![1];

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAA';
const OTHER = 'BBBBBBBBBBBBBBBBBBBBBB';
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
    for (const t of [TOKEN, OTHER]) {
      await setDoc(doc(db, 'invites', t), { editionId: EDITION, displayName: t });
      await setDoc(doc(db, 'reveals', t), { editionId: EDITION, groupName: 'Tribu Volcà', color: '#f00', image: null, selfKey: `k_${t}`, mateKeys: [] });
    }
    await setDoc(doc(db, 'responses', OTHER), { editionId: EDITION, answers: {}, completedAt: new Date() });
    await setDoc(doc(db, 'mateStatus', 'k_nou'), { editionId: EDITION, answeredAt: null });
    await setDoc(doc(db, 'mateCards', 'k_nou'), { editionId: EDITION, name: 'Anna' });
    await setDoc(doc(db, 'mateStatus', 'k_fet'), { editionId: EDITION, answeredAt: new Date() });
    await setDoc(doc(db, 'mateCards', 'k_fet'), { editionId: EDITION, name: 'Bernat' });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext('admin', { email: ADMIN_EMAIL, email_verified: true }).firestore();
const stranger = () => env.authenticatedContext('x', { email: 'algu@gmail.com', email_verified: true }).firestore();

const validResponse = () => ({ editionId: EDITION, answers: { s1: 'hola' }, completedAt: serverTimestamp() });

describe('participant anònim', () => {
  it('pot llegir la configuració pública i la seva invitació', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'publicEditions', EDITION)));
    await assertSucceeds(getDoc(doc(anon(), 'invites', TOKEN)));
  });

  it('NO pot llistar invitacions, respostes ni revelacions', async () => {
    await assertFails(getDocs(collection(anon(), 'invites')));
    await assertFails(getDocs(collection(anon(), 'responses')));
    await assertFails(getDocs(collection(anon(), 'reveals')));
  });

  it('NO pot llegir assignacions ni dades d’admin', async () => {
    await assertFails(getDoc(doc(anon(), 'editions', EDITION, 'participants', 'p1')));
    await assertFails(getDoc(doc(anon(), 'editions', EDITION, 'groups', 'g1')));
    await assertFails(getDoc(doc(anon(), 'editions', EDITION)));
  });

  it('NO pot veure la revelació abans de respondre', async () => {
    await assertFails(getDoc(doc(anon(), 'reveals', TOKEN)));
  });

  it('pot respondre i llavors veure la revelació', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(getDoc(doc(anon(), 'reveals', TOKEN)));
  });

  it('pot tornar a fer el qüestionari (substitueix la resposta) però amb les mateixes validacions', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'responses', TOKEN), validResponse()));
    await assertSucceeds(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), answers: { s1: 'adeu' } }));
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), groupId: 'g1' }));
  });

  it('NO pot tornar a jugar si l’admin ho ha desactivat', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'responses', TOKEN), validResponse()));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicEditions', EDITION), { title: 'T', allowRetake: false, lobby: { surveyOpen: true } });
    });
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), answers: { s1: 'adeu' } }));
  });

  it('NO pot respondre amb un token inexistent', async () => {
    await assertFails(setDoc(doc(anon(), 'responses', 'CCCCCCCCCCCCCCCCCCCCCC'), validResponse()));
  });

  it('NO pot falsejar camps, edició ni data', async () => {
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), groupId: 'g1' }));
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), editionId: '2099' }));
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), { ...validResponse(), completedAt: new Date(0) }));
  });

  it('NO pot respondre mentre l’enquesta és tancada (portada amb compte enrere)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicEditions', EDITION), { title: 'T', lobby: { surveyOpen: false } });
    });
    await assertFails(setDoc(doc(anon(), 'responses', TOKEN), validResponse()));
  });

  it('pot escoltar la configuració pública (portada en temps real)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'publicEditions', EDITION)));
    await assertFails(getDocs(collection(anon(), 'publicEditions')));
  });

  it('NO pot esborrar ni escriure revelacions', async () => {
    await assertFails(deleteDoc(doc(anon(), 'responses', OTHER)));
    await assertFails(setDoc(doc(anon(), 'reveals', TOKEN), { groupName: 'Hack' }));
  });
});

describe('companys que han contestat', () => {
  it('es pot saber si un company ha contestat, però NO el seu nom fins que ho fa', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'mateStatus', 'k_nou')));
    await assertFails(getDoc(doc(anon(), 'mateCards', 'k_nou')));
    await assertSucceeds(getDoc(doc(anon(), 'mateCards', 'k_fet')));
  });

  it('NO es poden llistar', async () => {
    await assertFails(getDocs(collection(anon(), 'mateStatus')));
    await assertFails(getDocs(collection(anon(), 'mateCards')));
  });

  it('es marca com a contestat un sol cop, amb l’hora del servidor, i llavors es veu el nom', async () => {
    await assertFails(updateDoc(doc(anon(), 'mateStatus', 'k_nou'), { answeredAt: new Date(0) }));
    await assertSucceeds(updateDoc(doc(anon(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(anon(), 'mateCards', 'k_nou')));
    await assertFails(updateDoc(doc(anon(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp() }));
  });

  it('NO es poden crear, desmarcar, ni tocar altres camps o els noms', async () => {
    await assertFails(setDoc(doc(anon(), 'mateStatus', 'k_inventat'), { editionId: EDITION, answeredAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(anon(), 'mateStatus', 'k_fet'), { answeredAt: null }));
    await assertFails(updateDoc(doc(anon(), 'mateStatus', 'k_nou'), { answeredAt: serverTimestamp(), editionId: '2099' }));
    await assertFails(setDoc(doc(anon(), 'mateCards', 'k_fet'), { editionId: EDITION, name: 'Hack' }));
    await assertFails(deleteDoc(doc(anon(), 'mateStatus', 'k_fet')));
  });
});

describe('usuari autenticat que no és admin', () => {
  it('no té més permisos que un anònim', async () => {
    await assertFails(getDoc(doc(stranger(), 'editions', EDITION, 'participants', 'p1')));
    await assertFails(getDocs(collection(stranger(), 'responses')));
  });
});

describe('admin', () => {
  it('pot llegir i escriure-ho tot', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'editions', EDITION, 'participants')));
    await assertSucceeds(getDocs(collection(admin(), 'responses')));
    await assertSucceeds(setDoc(doc(admin(), 'reveals', TOKEN), { groupName: 'X' }));
    await assertSucceeds(deleteDoc(doc(admin(), 'responses', OTHER)));
  });

  it('cal que l’email estigui verificat', async () => {
    const unverified = env.authenticatedContext('a', { email: ADMIN_EMAIL, email_verified: false }).firestore();
    await assertFails(getDocs(collection(unverified, 'responses')));
  });
});
