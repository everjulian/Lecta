import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import type { EmbeddingProvider } from './knowledge-types';

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  private pipeline: Promise<FeatureExtractionPipeline> | null = null;

  constructor(
    model = 'Xenova/multilingual-e5-small',
    private readonly cacheDirectory?: string,
  ) {
    this.model = model;
  }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) return [];
    const extractor = await this.getPipeline();
    const output = await extractor([...texts], { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }

  private getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipeline) {
      this.pipeline = import('@huggingface/transformers').then(({ env, pipeline }) => {
        if (this.cacheDirectory) env.cacheDir = this.cacheDirectory;
        return pipeline('feature-extraction', this.model, { dtype: 'q8' });
      });
    }
    return this.pipeline;
  }
}
