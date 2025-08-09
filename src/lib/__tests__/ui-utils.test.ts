/**
 * UI Utilities Tests
 * 
 * Tests for CSS class combination utility functions
 */

import { cn } from '../ui-utils';

describe('UI Utilities', () => {
  describe('cn function', () => {
    test('should handle single string input', () => {
      const result = cn('text-red-500');
      expect(result).toBe('text-red-500');
    });

    test('should handle multiple string inputs', () => {
      const result = cn('text-red-500', 'bg-blue-100', 'p-4');
      expect(result).toBe('text-red-500 bg-blue-100 p-4');
    });

    test('should handle conditional classes with boolean', () => {
      const result = cn(
        'base-class',
        true && 'conditional-true',
        false && 'conditional-false'
      );
      expect(result).toBe('base-class conditional-true');
    });

    test('should handle array inputs', () => {
      const result = cn(['text-sm', 'font-bold'], 'text-center');
      expect(result).toBe('text-sm font-bold text-center');
    });

    test('should handle object inputs with boolean values', () => {
      const result = cn({
        'text-red-500': true,
        'text-blue-500': false,
        'font-bold': true
      });
      expect(result).toBe('text-red-500 font-bold');
    });

    test('should handle mixed input types', () => {
      const result = cn(
        'base',
        ['array-class'],
        { 'object-true': true, 'object-false': false },
        'string-class'
      );
      expect(result).toBe('base array-class object-true string-class');
    });

    test('should merge conflicting Tailwind classes', () => {
      // twMerge should handle conflicting classes by keeping the last one
      const result = cn('p-2', 'p-4');
      expect(result).toBe('p-4');
    });

    test('should handle empty and undefined inputs', () => {
      const result = cn('', undefined, null, 'valid-class');
      expect(result).toBe('valid-class');
    });

    test('should handle no inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    test('should handle complex nested conditions', () => {
      const isActive = true;
      const isDisabled = false;
      const size = 'lg';

      const result = cn(
        'button',
        {
          'button-active': isActive,
          'button-disabled': isDisabled,
          [`button-${size}`]: size
        },
        isActive && 'active-state',
        !isDisabled && 'enabled-state'
      );

      expect(result).toContain('button');
      expect(result).toContain('button-active');
      expect(result).toContain('button-lg');
      expect(result).toContain('active-state');
      expect(result).toContain('enabled-state');
      expect(result).not.toContain('button-disabled');
    });

    test('should handle whitespace and duplicates correctly', () => {
      const result = cn('  text-sm  ', 'text-sm', '  font-bold  ');
      // Should remove duplicates and extra whitespace
      expect(result.trim()).toBe('text-sm font-bold');
    });

    test('should preserve non-conflicting Tailwind classes', () => {
      const result = cn('text-red-500', 'bg-blue-100', 'p-4', 'm-2');
      expect(result).toBe('text-red-500 bg-blue-100 p-4 m-2');
    });
  });
});