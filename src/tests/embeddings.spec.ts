import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { EmbeddingModel } from 'ai';
import { EmbeddingManager, combineScores } from '../modules/embeddings';

// Mock AI SDK embedding functions
const mockEmbed = mock();
const mockEmbedMany = mock();

// Mock model type
type MockEmbeddingModel = EmbeddingModel<string>;

mock.module('ai', () => ({
  embed: mockEmbed,
  embedMany: mockEmbedMany,
  cosineSimilarity: (a: number[], b: number[]) => {
    // Simple dot product for testing
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  },
}));

describe('EmbeddingManager', () => {
  beforeEach(() => {
    mockEmbed.mockClear();
    mockEmbedMany.mockClear();
  });

  it('should be disabled without config', () => {
    const manager = new EmbeddingManager();
    expect(manager.isEnabled).toBe(false);
  });

  it('should be enabled with model config', () => {
    const mockModel = { modelId: 'test-model' } as MockEmbeddingModel;
    const manager = new EmbeddingManager({ model: mockModel });
    expect(manager.isEnabled).toBe(true);
  });

  it('should return null for single embedding when disabled', async () => {
    const manager = new EmbeddingManager();
    const result = await manager.generateEmbedding('test');
    expect(result).toBe(null);
  });

  it('should return null array for batch embeddings when disabled', async () => {
    const manager = new EmbeddingManager();
    const result = await manager.generateEmbeddings(['test1', 'test2']);
    expect(result).toEqual([null, null]);
  });

  it('should generate single embedding when enabled', async () => {
    const mockModel = { modelId: 'test-model' } as MockEmbeddingModel;
    const manager = new EmbeddingManager({ model: mockModel });

    const mockEmbedding = [0.1, 0.2, 0.3];
    mockEmbed.mockResolvedValueOnce({ embedding: mockEmbedding });

    const result = await manager.generateEmbedding('test text');

    expect(mockEmbed).toHaveBeenCalledWith({
      model: mockModel,
      value: 'test text',
    });
    expect(result).toEqual(mockEmbedding);
  });

  it('should generate batch embeddings when enabled', async () => {
    const mockModel = { modelId: 'test-model' } as MockEmbeddingModel;
    const manager = new EmbeddingManager({ model: mockModel });

    const mockEmbeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    mockEmbedMany.mockResolvedValueOnce({ embeddings: mockEmbeddings });

    const result = await manager.generateEmbeddings(['test1', 'test2']);

    expect(mockEmbedMany).toHaveBeenCalledWith({
      model: mockModel,
      values: ['test1', 'test2'],
    });
    expect(result).toEqual(mockEmbeddings);
  });

  it('should handle empty array for batch embeddings', async () => {
    const mockModel = { modelId: 'test-model' } as MockEmbeddingModel;
    const manager = new EmbeddingManager({ model: mockModel });

    const result = await manager.generateEmbeddings([]);

    expect(mockEmbedMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe('combineScores', () => {
  it('should combine scores with equal weights by default', () => {
    const result = combineScores(0.8, 0.6);
    expect(result).toBe(0.7); // (0.8 * 0.5) + (0.6 * 0.5)
  });

  it('should combine scores with custom weights', () => {
    const result = combineScores(0.8, 0.6, { text: 0.7, vector: 0.3 });
    expect(result).toBe(0.74); // (0.8 * 0.7) + (0.6 * 0.3)
  });

  it('should normalize weights that do not sum to 1', () => {
    const result = combineScores(0.8, 0.6, { text: 2, vector: 1 });
    // Normalized weights: text = 2/3, vector = 1/3
    expect(result).toBeCloseTo(0.733); // (0.8 * 2/3) + (0.6 * 1/3)
  });

  it('should handle zero weights', () => {
    const result = combineScores(0.8, 0.6, { text: 1, vector: 0 });
    expect(result).toBe(0.8); // Only text score
  });
});
