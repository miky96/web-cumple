import { useEffect, useState } from 'react';
import type { Repo } from '../../data/repo';
import { reportRepoError } from '../../data/errors';
import type { ResponseWithToken } from '../../data/ports';
import type { ArcadeBoard } from '../../domain/arcade/arcade';
import type { Contact, Edition, Group, LinkedAccount, Participant, PublicEdition } from '../../domain/types';

export interface AdminData {
  ready: boolean;
  edition: Edition | null;
  publicEdition: PublicEdition | null;
  participants: Participant[];
  groups: Group[];
  responses: ResponseWithToken[];
  responseByToken: Map<string, ResponseWithToken>;
  /** Compte que ha reclamat cada enllaç. */
  accountByToken: Map<string, LinkedAccount>;
  /** Correu de contacte (privat) de cada enllaç. */
  contactByToken: Map<string, Contact>;
  /** Millors marques de la sala arcade per enllaç. */
  arcadeByToken: Map<string, ArcadeBoard>;
}

const byName = (a: Participant, b: Participant) => a.name.localeCompare(b.name, 'ca');

export function useAdminData(repo: Repo, editionId: string): AdminData {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [publicEdition, setPublicEdition] = useState<PublicEdition | null>(null);
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [responses, setResponses] = useState<ResponseWithToken[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [arcade, setArcade] = useState<{ token: string; board: ArcadeBoard }[]>([]);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let alive = true;
    repo
      .ensureEdition(editionId)
      .catch(reportRepoError)
      .finally(() => {
      if (!alive) return;
      unsubs = [
        repo.watchEdition(editionId, setEdition),
        repo.watchPublicEdition(editionId, setPublicEdition),
        repo.watchParticipants(editionId, (ps) => setParticipants([...ps].sort(byName))),
        repo.watchGroups(editionId, setGroups),
        repo.watchResponses(editionId, setResponses),
        repo.watchAccounts(editionId, setAccounts),
        repo.watchContacts(editionId, setContacts),
        repo.watchArcade(editionId, setArcade),
      ];
    });
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [repo, editionId]);

  return {
    ready: participants !== null && edition !== null,
    edition,
    publicEdition,
    participants: participants ?? [],
    groups,
    responses,
    responseByToken: new Map(responses.map((r) => [r.token, r])),
    accountByToken: new Map(accounts.map((a) => [a.token, a])),
    contactByToken: new Map(contacts.map((c) => [c.token, c])),
    arcadeByToken: new Map(arcade.map((a) => [a.token, a.board])),
  };
}
