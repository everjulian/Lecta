import path from 'node:path';

export type E2EScenario =
  'success' | 'transcription-failure' | 'ai-timeout' | 'knowledge-failure' | 'missing-recording';

export interface E2EConfig {
  readonly userDataPath: string;
  readonly scenario: E2EScenario;
}

const scenarios: readonly E2EScenario[] = [
  'success',
  'transcription-failure',
  'ai-timeout',
  'knowledge-failure',
  'missing-recording',
];

export function readE2EConfig(isPackaged: boolean): E2EConfig | null {
  if (process.env['LECTA_E2E'] !== '1') return null;
  if (isPackaged) throw new Error('LECTA_E2E is not available in packaged applications');
  const userDataPath = process.env['LECTA_E2E_USER_DATA'];
  if (!userDataPath || !path.isAbsolute(userDataPath))
    throw new Error('LECTA_E2E_USER_DATA must be an absolute temporary path');
  const scenario = process.env['LECTA_E2E_SCENARIO'] ?? 'success';
  if (!scenarios.includes(scenario as E2EScenario)) throw new Error('Invalid E2E scenario');
  return { userDataPath: path.resolve(userDataPath), scenario: scenario as E2EScenario };
}
