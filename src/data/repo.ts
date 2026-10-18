import type { AdminRepo, PublicRepo } from './ports';

export type Repo = PublicRepo & AdminRepo;

export const EDITION_ID: string = import.meta.env.VITE_EDITION_ID ?? '2027';
export const IS_DEMO: boolean = import.meta.env.VITE_DEMO === '1';

let instance: Promise<Repo> | null = null;

/**
 * Tria l'adaptador en temps d'execució. Els imports dinàmics fan que en mode demo
 * no es carregui Firebase i en producció no es carregui el codi de demo.
 */
export function getRepo(): Promise<Repo> {
  instance ??= IS_DEMO
    ? import('./memory/memoryRepo').then((m) => new m.MemoryRepo(EDITION_ID))
    : import('./firestore/firestoreRepo').then((m) => new m.FirestoreRepo());
  return instance;
}
