import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { ValidationError } from '../src/utils/errors.js';
import {
  buildCreateCharacterPayload,
  parseDnaJson,
  validateCharacterAge,
  validateCharacterName,
} from '../src/services/characters.service.js';

describe('characters client-side validation', () => {
  describe('description path (web parity)', () => {
    it('builds a description payload with scene and public default handling', () => {
      expect(
        buildCreateCharacterPayload({ description: 'playful italian street musician woman', scene: 'at a public piano', isPublic: true }),
      ).toEqual({ description: 'playful italian street musician woman', scene_prompt: 'at a public piano', is_public: true });
    });

    it('description wins over structured fields', () => {
      const payload = buildCreateCharacterPayload({ description: 'a calm nordic hiking enthusiast', name: 'Ignored Name' });
      expect(payload).toEqual({ description: 'a calm nordic hiking enthusiast' });
    });

    it('rejects a description under 10 chars', () => {
      expect(() => buildCreateCharacterPayload({ description: 'too short' })).toThrow(ValidationError);
    });

    it('rejects a description over 1000 chars', () => {
      expect(() => buildCreateCharacterPayload({ description: 'x'.repeat(1001) })).toThrow(ValidationError);
    });

    it('rejects a scene over 600 chars', () => {
      expect(() =>
        buildCreateCharacterPayload({ description: 'a valid description here', scene: 'x'.repeat(601) }),
      ).toThrow(ValidationError);
    });
  });

  describe('make_video / motion_prompt', () => {
    it('sends make_video: true (and a trimmed motion_prompt) when requested', () => {
      expect(
        buildCreateCharacterPayload({
          description: 'a valid description here',
          makeVideo: true,
          motionPrompt: '  waves at the camera  ',
        }),
      ).toEqual({
        description: 'a valid description here',
        make_video: true,
        motion_prompt: 'waves at the camera',
      });
    });

    it('omits make_video and motion_prompt when not requested (server default false)', () => {
      const payload = buildCreateCharacterPayload({ description: 'a valid description here' });
      expect(payload).not.toHaveProperty('make_video');
      expect(payload).not.toHaveProperty('motion_prompt');
    });

    it('works on the structured path too', () => {
      const payload = buildCreateCharacterPayload({ name: 'Jo Doe', makeVideo: true });
      expect(payload.make_video).toBe(true);
      expect(payload).not.toHaveProperty('motion_prompt');
    });

    it('rejects --motion-prompt without --make-video', () => {
      expect(() =>
        buildCreateCharacterPayload({ description: 'a valid description here', motionPrompt: 'waves' }),
      ).toThrow(ValidationError);
      expect(() =>
        buildCreateCharacterPayload({ description: 'a valid description here', motionPrompt: 'waves' }),
      ).toThrow(/--make-video/);
    });
  });

  describe('name (2-120 chars)', () => {
    it('rejects a 1-char name with a helpful message', () => {
      expect(() => buildCreateCharacterPayload({ name: 'A' })).toThrow(ValidationError);
      expect(() => buildCreateCharacterPayload({ name: 'A' })).toThrow(/2-120 characters/);
    });

    it('rejects an empty / whitespace-only name', () => {
      expect(() => buildCreateCharacterPayload({ name: '' })).toThrow(ValidationError);
      expect(() => buildCreateCharacterPayload({ name: '   ' })).toThrow(ValidationError);
    });

    it('rejects a name over 120 chars', () => {
      expect(() => buildCreateCharacterPayload({ name: 'x'.repeat(121) })).toThrow(ValidationError);
    });

    it('accepts boundary lengths and trims whitespace', () => {
      expect(validateCharacterName('Jo')).toBe('Jo');
      expect(validateCharacterName('x'.repeat(120))).toBe('x'.repeat(120));
      expect(validateCharacterName('  Emma Stone  ')).toBe('Emma Stone');
    });
  });

  describe('age (18-99)', () => {
    it('rejects ages below 18 and above 99', () => {
      expect(() => buildCreateCharacterPayload({ name: 'Jo Doe', age: 17 })).toThrow(ValidationError);
      expect(() => buildCreateCharacterPayload({ name: 'Jo Doe', age: 17 })).toThrow(/between 18 and 99/);
      expect(() => buildCreateCharacterPayload({ name: 'Jo Doe', age: 100 })).toThrow(ValidationError);
    });

    it('rejects non-integer ages', () => {
      expect(() => validateCharacterAge(25.5)).toThrow(ValidationError);
    });

    it('accepts boundary ages', () => {
      expect(validateCharacterAge(18)).toBe(18);
      expect(validateCharacterAge(99)).toBe(99);
      expect(buildCreateCharacterPayload({ name: 'Jo Doe', age: 18 }).age).toBe(18);
    });
  });

  describe('parseDnaJson', () => {
    it('parses inline JSON starting with {', async () => {
      await expect(parseDnaJson('{"hair_color": "black", "vibe": "chill"}')).resolves.toEqual({
        hair_color: 'black',
        vibe: 'chill',
      });
    });

    it('rejects invalid inline JSON', async () => {
      await expect(parseDnaJson('{not json')).rejects.toThrow(ValidationError);
    });

    it('rejects non-object JSON', async () => {
      await expect(parseDnaJson('["a"]')).rejects.toThrow(ValidationError);
    });

    it('reads a JSON file when the value is a path', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipugc-dna-'));
      const file = path.join(dir, 'dna.json');
      await fs.writeJson(file, { eye_color: 'green' });
      try {
        await expect(parseDnaJson(file)).resolves.toEqual({ eye_color: 'green' });
      } finally {
        await fs.remove(dir);
      }
    });

    it('rejects a missing file with a helpful message', async () => {
      await expect(parseDnaJson('/nonexistent/dna.json')).rejects.toThrow(ValidationError);
      await expect(parseDnaJson('/nonexistent/dna.json')).rejects.toThrow(/dna-json file/);
    });
  });
});
