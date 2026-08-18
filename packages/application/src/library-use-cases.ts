import { ApplicationError } from './errors';
import type { LibraryPage, LibraryQuery, LibraryRepository } from './ports';

export class SearchLibrary {
  constructor(private readonly library: LibraryRepository) {}

  execute(input: LibraryQuery): Promise<LibraryPage> {
    if (!Number.isInteger(input.page) || input.page < 1) {
      throw new ApplicationError('Library page must be positive', 'INVALID_LIBRARY_QUERY');
    }
    if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 50) {
      throw new ApplicationError(
        'Library page size must be between 1 and 50',
        'INVALID_LIBRARY_QUERY',
      );
    }
    return this.library.search({
      ...input,
      text: input.text?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
    });
  }
}

export class ListLibrarySubjects {
  constructor(private readonly library: LibraryRepository) {}
  execute(): Promise<readonly string[]> {
    return this.library.listSubjects();
  }
}
