import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Ref que sempre apunta a l'últim `value` (p. ex. un callback), per llegir-lo des d'effects o handlers
 * sense haver-lo de posar a les dependències.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Esborrany local d'un valor que arriba del servidor (Firestore en temps real).
 * Quan `remote` canvia, l'esborrany es reinicia a partir d'ell, excepte si `enabled` és false
 * (p. ex. l'usuari té canvis sense desar). Patró "ajustar estat durant el render" recomanat per React,
 * en lloc d'un useEffect amb setState: https://react.dev/learn/you-might-not-need-an-effect
 *
 * Important: `remote` ha de ser estable entre renders (no passis `x ?? []`; fes el default a `toDraft`).
 */
export function useRemoteDraft<R, T>(
  remote: R,
  toDraft: (remote: R) => T,
  enabled = true,
): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState(() => toDraft(remote));
  const [seen, setSeen] = useState(remote);
  if (!Object.is(remote, seen)) {
    setSeen(remote);
    if (enabled) setDraft(toDraft(remote));
  }
  return [draft, setDraft];
}
