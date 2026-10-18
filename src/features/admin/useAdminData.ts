import { useEffect, useState } from 'react';
import type { Repo } from '../../data/repo';
import { reportRepoError } from '../../data/errors';
import type { ResponseWithToken } from '../../data/ports';
import type { Edition, Group, Participant, PublicEdition } from '../../domain/types';

export interface AdminData {
  ready: boolean;
  edition: Edition | null;
  publicEdition: PublicEdition | null;
  participants: Participant[];
  groups: Group[];
  responses: ResponseWithToken[];
  responseByToken: Map<string, ResponseWithToken>;
}

const byName = (a: Participant, b: Participant) => a.name.localeCompare(b.name, 'ca');

export function useAdminData(repo: Repo, editionId: string): AdminData {
  const [edition, setEdition] = useState<Edition | null>(null);
  const [publicEdition, setPublicEdition] = useState<PublicEdition | null>(null);
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [responses, setResponses] = useState<ResponseWithToken[]>([]);

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
  };
}
