import { describe, it, expect } from 'vitest'
import { commentKeys, documentKeys } from '@/lib/react-query/queryKeys'

describe('commentKeys', () => {
  it('should have correct root key', () => {
    expect(commentKeys.all).toEqual(['comments'])
  })

  it('should build entity key with type and id', () => {
    expect(commentKeys.byEntity('intervention', 'abc-123')).toEqual([
      'comments', 'intervention', 'abc-123',
    ])
  })

  it('should build paginated key compatible with CommentSection format', () => {
    const key = commentKeys.byEntityPaginated('intervention', 'abc-123', 50)
    // Must match the format previously hardcoded in CommentSection:
    // ["comments", entityType, entityId, limit]
    expect(key).toEqual(['comments', 'intervention', 'abc-123', 50])
  })

  it('should build invalidation key that matches all paginations of an entity', () => {
    const invalidateKey = commentKeys.invalidateByEntity('intervention', 'abc-123')
    const paginatedKey = commentKeys.byEntityPaginated('intervention', 'abc-123', 50)

    // The invalidation key should be a prefix of the paginated key
    // This ensures queryClient.invalidateQueries({ queryKey: invalidateKey })
    // will match ALL paginated variants for this entity
    expect(paginatedKey.slice(0, invalidateKey.length)).toEqual([...invalidateKey])
  })

  it('should support artisan entity type', () => {
    expect(commentKeys.byEntity('artisan', 'art-456')).toEqual([
      'comments', 'artisan', 'art-456',
    ])
  })

  it('should build invalidateAll key that matches everything', () => {
    const allKey = commentKeys.invalidateAll()
    expect(allKey).toEqual(['comments'])

    // Should be a prefix of any entity key
    const entityKey = commentKeys.byEntity('intervention', 'abc-123')
    expect(entityKey.slice(0, allKey.length)).toEqual([...allKey])
  })
})

describe('documentKeys', () => {
  it('should have correct root key', () => {
    expect(documentKeys.all).toEqual(['documents'])
  })

  it('should build entity key', () => {
    expect(documentKeys.byEntity('intervention', 'abc-123')).toEqual([
      'documents', 'intervention', 'abc-123',
    ])
  })

  it('should build invalidation key as entity prefix', () => {
    const invalidateKey = documentKeys.invalidateByEntity('intervention', 'abc-123')
    expect(invalidateKey).toEqual(['documents', 'intervention', 'abc-123'])
  })

  it('should build invalidateAll key', () => {
    expect(documentKeys.invalidateAll()).toEqual(['documents'])
  })
})
