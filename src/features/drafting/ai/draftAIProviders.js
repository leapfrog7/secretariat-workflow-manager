import { requestLocalDraftAI } from '../../../services/lmStudioClient';
import { requestCloudDraftAI } from '../../../services/cloudAIClient';

export function createDraftAIProvider(configuration = {}) {
  if (configuration.mode === 'cloud') {
    return {
      id: `cloud:${configuration.provider || 'gemini'}`,
      async generateText({ operation, instructions, input, signal }) {
        return requestCloudDraftAI({
          workspaceId: configuration.workspaceId,
          issueId: configuration.issueId,
          provider: configuration.provider,
          taskLevel: configuration.taskLevel,
          operation,
          instructions,
          input,
          signal,
        });
      },
    };
  }

  return {
    id: 'local:lm-studio',
    async generateText({ operation, instructions, input, signal }) {
      return requestLocalDraftAI({
        settings: configuration.settings,
        operation,
        instructions,
        input,
        signal,
      });
    },
  };
}
