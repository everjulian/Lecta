import { ipcMain } from 'electron';
import type { Session, SessionType } from '@lecta/domain';
import {
  sessionChannels,
  sessionTypes,
  type CreateSessionInput,
  type SessionDto,
  type LibraryQueryDto,
} from '../shared/session-contracts.js';
import type { ApplicationContainer } from './container.js';

const toDto = (session: Session): SessionDto => ({
  ...session.toPrimitives(),
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  tags: session.tags,
});

const requireId = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('A non-empty session id is required');
  }
  return value;
};

const requireCreateInput = (value: unknown): CreateSessionInput => {
  if (!value || typeof value !== 'object') throw new TypeError('Session input is required');
  const input = value as Readonly<Record<string, unknown>>;
  if (typeof input['title'] !== 'string' || !input['title'].trim() || input['title'].length > 120) {
    throw new TypeError('A non-empty session title is required');
  }
  if (
    typeof input['type'] !== 'string' ||
    !sessionTypes.includes(input['type'] as CreateSessionInput['type'])
  ) {
    throw new TypeError('A valid session type is required');
  }
  if (
    input['subject'] !== undefined &&
    (typeof input['subject'] !== 'string' || input['subject'].length > 120)
  ) {
    throw new TypeError('Session subject must be a string');
  }
  if (
    input['tags'] !== undefined &&
    (!Array.isArray(input['tags']) ||
      input['tags'].length > 12 ||
      input['tags'].some((tag) => typeof tag !== 'string' || tag.length > 60))
  ) {
    throw new TypeError('Session tags must be strings');
  }
  return {
    title: input['title'],
    type: input['type'] as CreateSessionInput['type'],
    ...(typeof input['subject'] === 'string' ? { subject: input['subject'] } : {}),
    ...(Array.isArray(input['tags']) ? { tags: input['tags'] as string[] } : {}),
  };
};

const requireLibraryQuery = (value: unknown): LibraryQueryDto => {
  if (!value || typeof value !== 'object') throw new TypeError('Library query is required');
  const input = value as Readonly<Record<string, unknown>>;
  if (!Number.isInteger(input['page']) || !Number.isInteger(input['pageSize'])) {
    throw new TypeError('Invalid library pagination');
  }
  if (
    (input['page'] as number) < 1 ||
    (input['page'] as number) > 1_000_000 ||
    (input['pageSize'] as number) < 1 ||
    (input['pageSize'] as number) > 50
  ) {
    throw new TypeError('Library pagination is out of range');
  }
  if (input['sort'] !== 'NEWEST' && input['sort'] !== 'OLDEST') {
    throw new TypeError('Invalid library sorting');
  }
  if (input['type'] !== undefined && !sessionTypes.includes(input['type'] as SessionDto['type'])) {
    throw new TypeError('Invalid library type');
  }
  for (const field of ['text', 'subject', 'dateFrom', 'dateTo'] as const) {
    if (input[field] !== undefined && typeof input[field] !== 'string')
      throw new TypeError(`Invalid ${field}`);
  }
  if (
    (typeof input['text'] === 'string' && input['text'].length > 500) ||
    (typeof input['subject'] === 'string' && input['subject'].length > 120)
  ) {
    throw new TypeError('Library filters are too long');
  }
  for (const field of ['dateFrom', 'dateTo'] as const) {
    const candidate = input[field];
    if (typeof candidate === 'string' && Number.isNaN(Date.parse(candidate))) {
      throw new TypeError(`Invalid ${field}`);
    }
  }
  return input as unknown as LibraryQueryDto;
};

export function registerSessionHandlers({ useCases }: ApplicationContainer): void {
  ipcMain.handle(sessionChannels.create, async (_event, input: unknown) => {
    const valid = requireCreateInput(input);
    return toDto(
      await useCases.createSession.execute({
        ...valid,
        type: valid.type as SessionType,
        tags: valid.tags,
      }),
    );
  });
  ipcMain.handle(sessionChannels.get, async (_event, id: unknown) =>
    toDto(await useCases.getSession.execute(requireId(id))),
  );
  ipcMain.handle(sessionChannels.list, async () =>
    (await useCases.listSessions.execute()).map(toDto),
  );
  ipcMain.handle(sessionChannels.searchLibrary, async (_event, value: unknown) => {
    const query = requireLibraryQuery(value);
    const result = await useCases.searchLibrary.execute({
      ...query,
      type: query.type,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        tags: item.tags,
      })),
    };
  });
  ipcMain.handle(sessionChannels.listSubjects, () => useCases.listLibrarySubjects.execute());
  ipcMain.handle(sessionChannels.start, async (_event, id: unknown) =>
    toDto(await useCases.startRecording.execute(requireId(id))),
  );
  ipcMain.handle(sessionChannels.pause, async (_event, id: unknown) =>
    toDto(await useCases.pauseRecording.execute(requireId(id))),
  );
  ipcMain.handle(sessionChannels.resume, async (_event, id: unknown) =>
    toDto(await useCases.resumeRecording.execute(requireId(id))),
  );
  ipcMain.handle(sessionChannels.finish, async (_event, id: unknown) =>
    toDto(await useCases.finishSession.execute(requireId(id))),
  );
}
