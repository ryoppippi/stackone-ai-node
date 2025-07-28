import { describe, expect, it } from 'bun:test';
import { removeJsonSchemaProperty, withoutJsonSchemaProperty } from './schema';

describe('removeJsonSchemaProperty', () => {
  it('should remove existing property by setting it to undefined', () => {
    const obj = { prop1: 'value1', prop2: 'value2', prop3: 'value3' };
    
    removeJsonSchemaProperty(obj, 'prop2');
    
    expect(obj.prop2).toBeUndefined();
    expect(obj.prop1).toBe('value1');
    expect(obj.prop3).toBe('value3');
  });

  it('should handle removing non-existent property gracefully', () => {
    const obj = { prop1: 'value1', prop2: 'value2' };
    
    removeJsonSchemaProperty(obj, 'nonExistent');
    
    expect(obj.prop1).toBe('value1');
    expect(obj.prop2).toBe('value2');
    expect(obj.nonExistent).toBeUndefined();
  });

  it('should handle null object gracefully', () => {
    expect(() => removeJsonSchemaProperty(null as any, 'prop')).not.toThrow();
  });

  it('should handle undefined object gracefully', () => {
    expect(() => removeJsonSchemaProperty(undefined as any, 'prop')).not.toThrow();
  });

  it('should work with different value types', () => {
    const obj = {
      stringProp: 'string',
      numberProp: 42,
      booleanProp: true,
      objectProp: { nested: 'value' },
      arrayProp: [1, 2, 3],
      nullProp: null
    };

    removeJsonSchemaProperty(obj, 'numberProp');
    removeJsonSchemaProperty(obj, 'objectProp');
    removeJsonSchemaProperty(obj, 'arrayProp');

    expect(obj.stringProp).toBe('string');
    expect(obj.booleanProp).toBe(true);
    expect(obj.nullProp).toBe(null);
    expect(obj.numberProp).toBeUndefined();
    expect(obj.objectProp).toBeUndefined();
    expect(obj.arrayProp).toBeUndefined();
  });

  it('should preserve other properties when removing one', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    
    removeJsonSchemaProperty(obj, 'b');
    
    expect(Object.keys(obj)).toEqual(['a', 'b', 'c', 'd']); // Keys still exist
    expect(obj.a).toBe(1);
    expect(obj.b).toBeUndefined();
    expect(obj.c).toBe(3);
    expect(obj.d).toBe(4);
  });
});

describe('withoutJsonSchemaProperty', () => {
  it('should return new object without specified property', () => {
    const original = { prop1: 'value1', prop2: 'value2', prop3: 'value3' };
    
    const result = withoutJsonSchemaProperty(original, 'prop2');
    
    expect(result).not.toBe(original); // Should be a new object
    expect(result.prop1).toBe('value1');
    expect(result.prop2).toBeUndefined();
    expect(result.prop3).toBe('value3');
    
    // Original should be unchanged
    expect(original.prop1).toBe('value1');
    expect(original.prop2).toBe('value2');
    expect(original.prop3).toBe('value3');
  });

  it('should return original object when property does not exist', () => {
    const original = { prop1: 'value1', prop2: 'value2' };
    
    const result = withoutJsonSchemaProperty(original, 'nonExistent');
    
    expect(result).toBe(original); // Should return same object reference
    expect(result.prop1).toBe('value1');
    expect(result.prop2).toBe('value2');
  });

  it('should return original object when object is null', () => {
    const result = withoutJsonSchemaProperty(null as any, 'prop');
    
    expect(result).toBe(null);
  });

  it('should return original object when object is undefined', () => {
    const result = withoutJsonSchemaProperty(undefined as any, 'prop');
    
    expect(result).toBe(undefined);
  });

  it('should create shallow copy - nested objects are shared', () => {
    const nestedObj = { nested: 'value' };
    const original = { 
      prop1: 'value1', 
      prop2: 'value2', 
      nestedProp: nestedObj 
    };
    
    const result = withoutJsonSchemaProperty(original, 'prop2');
    
    expect(result).not.toBe(original);
    expect(result.nestedProp).toBe(nestedObj); // Shallow copy - same reference
    expect(result.prop1).toBe('value1');
    expect(result.prop2).toBeUndefined();
    expect(result.nestedProp).toBe(original.nestedProp);
  });

  it('should work with different value types', () => {
    const original = {
      stringProp: 'string',
      numberProp: 42,
      booleanProp: true,
      objectProp: { nested: 'value' },
      arrayProp: [1, 2, 3],
      nullProp: null,
      undefinedProp: undefined
    };

    const result = withoutJsonSchemaProperty(original, 'numberProp');

    expect(result.stringProp).toBe('string');
    expect(result.booleanProp).toBe(true);
    expect(result.objectProp).toEqual({ nested: 'value' });
    expect(result.arrayProp).toEqual([1, 2, 3]);
    expect(result.nullProp).toBe(null);
    expect(result.undefinedProp).toBeUndefined();
    expect(result.numberProp).toBeUndefined();
    
    // Original should be unchanged
    expect(original.numberProp).toBe(42);
  });

  it('should handle empty object', () => {
    const original = {};
    
    const result = withoutJsonSchemaProperty(original, 'anyProp');
    
    expect(result).toBe(original); // Same object since property doesn't exist
    expect(Object.keys(result)).toEqual([]);
  });

  it('should handle object with only the property to remove', () => {
    const original = { onlyProp: 'value' };
    
    const result = withoutJsonSchemaProperty(original, 'onlyProp');
    
    expect(result).not.toBe(original);
    expect(result.onlyProp).toBeUndefined();
    expect(Object.keys(result)).toEqual(['onlyProp']); // Key exists but value is undefined
    
    // Original unchanged
    expect(original.onlyProp).toBe('value');
  });

  it('should not preserve prototype chain (uses spread operator)', () => {
    class TestClass {
      prop1 = 'value1';
      prop2 = 'value2';
    }
    
    const original = new TestClass();
    const result = withoutJsonSchemaProperty(original, 'prop2');
    
    expect(result).not.toBeInstanceOf(TestClass); // Spread operator loses prototype
    expect(result.prop1).toBe('value1');
    expect(result.prop2).toBeUndefined();
  });
});