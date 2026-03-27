import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, mdaAliases } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import * as mdaService from './mdaService';

let healthMdaId: string;
let financeMdaId: string;
let inactiveMdaId: string;
let agricultureMdaId: string;
let cduMdaId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE refresh_tokens, audit_log, users, mdas CASCADE`);

  healthMdaId = generateUuidv7();
  financeMdaId = generateUuidv7();
  inactiveMdaId = generateUuidv7();
  agricultureMdaId = generateUuidv7();
  cduMdaId = generateUuidv7();

  await db.insert(mdas).values([
    { id: healthMdaId, name: 'Ministry of Health', code: 'HEALTH', abbreviation: 'Health' },
    { id: financeMdaId, name: 'Ministry of Finance', code: 'FINANCE', abbreviation: 'Finance' },
    { id: inactiveMdaId, name: 'Defunct Agency', code: 'DEFUNCT', abbreviation: 'Defunct', isActive: false },
    { id: agricultureMdaId, name: 'Ministry of Agriculture', code: 'AGRICULTURE', abbreviation: 'Agriculture' },
    { id: cduMdaId, name: 'Cocoa Development Unit', code: 'CDU', abbreviation: 'CDU', parentMdaId: agricultureMdaId },
  ]);

  // Seed aliases for testing layer 3
  await db.insert(mdaAliases).values([
    { id: generateUuidv7(), mdaId: healthMdaId, alias: 'HLT' },
    { id: generateUuidv7(), mdaId: healthMdaId, alias: 'Ministry of Health Oyo' },
    { id: generateUuidv7(), mdaId: financeMdaId, alias: 'MOF' },
    { id: generateUuidv7(), mdaId: cduMdaId, alias: 'COCOA DEVELOPMENT UNIT' },
    { id: generateUuidv7(), mdaId: cduMdaId, alias: 'TCDU' },
  ]);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE refresh_tokens, audit_log, users, mdas CASCADE`);
});

describe('mdaService.listMdas', () => {
  it('returns only active MDAs by default', async () => {
    const result = await mdaService.listMdas();
    expect(result.length).toBe(4);
    expect(result.every((m) => m.isActive)).toBe(true);
  });

  it('returns inactive MDAs when filtered', async () => {
    const result = await mdaService.listMdas({ isActive: false });
    expect(result.length).toBe(1);
    expect(result[0].code).toBe('DEFUNCT');
  });

  it('filters by search term', async () => {
    const result = await mdaService.listMdas({ search: 'Health' });
    expect(result.length).toBe(1);
    expect(result[0].code).toBe('HEALTH');
  });

  it('scopes to specific MDA for mda_officer', async () => {
    const result = await mdaService.listMdas({}, healthMdaId);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(healthMdaId);
  });

  it('returns all MDAs when scope is null (admin)', async () => {
    const result = await mdaService.listMdas({}, null);
    expect(result.length).toBe(4); // 4 active
  });

  it('returns MdaListItem shape with parent fields', async () => {
    const result = await mdaService.listMdas();
    const mda = result[0];
    expect(mda).toHaveProperty('id');
    expect(mda).toHaveProperty('code');
    expect(mda).toHaveProperty('name');
    expect(mda).toHaveProperty('abbreviation');
    expect(mda).toHaveProperty('isActive');
    expect(mda).toHaveProperty('parentMdaId');
    expect(mda).toHaveProperty('parentMdaCode');
  });
});

describe('mdaService.getMdaById', () => {
  it('returns MDA by ID', async () => {
    const mda = await mdaService.getMdaById(healthMdaId);
    expect(mda.code).toBe('HEALTH');
    expect(mda.abbreviation).toBe('Health');
  });

  it('throws 404 for non-existent MDA', async () => {
    await expect(mdaService.getMdaById(generateUuidv7())).rejects.toMatchObject({
      statusCode: 404,
      code: 'MDA_NOT_FOUND',
    });
  });
});

describe('mdaService.resolveMdaByName (4-layer matching)', () => {
  it('Layer 1: matches by exact code', async () => {
    const mda = await mdaService.resolveMdaByName('HEALTH');
    expect(mda).not.toBeNull();
    expect(mda!.code).toBe('HEALTH');
  });

  it('Layer 1: case-insensitive code match', async () => {
    const mda = await mdaService.resolveMdaByName('health');
    expect(mda).not.toBeNull();
    expect(mda!.code).toBe('HEALTH');
  });

  it('Layer 2: normalised name match (strips prefix)', async () => {
    const mda = await mdaService.resolveMdaByName('Ministry of Health');
    expect(mda).not.toBeNull();
    expect(mda!.code).toBe('HEALTH');
  });

  it('Layer 3: alias table lookup', async () => {
    const mda = await mdaService.resolveMdaByName('HLT');
    expect(mda).not.toBeNull();
    expect(mda!.code).toBe('HEALTH');
  });

  it('Layer 3: alias lookup is case-insensitive', async () => {
    const mda = await mdaService.resolveMdaByName('mof');
    expect(mda).not.toBeNull();
    expect(mda!.code).toBe('FINANCE');
  });

  it('Layer 4: returns null for unresolvable name', async () => {
    const mda = await mdaService.resolveMdaByName('Completely Unknown Agency');
    expect(mda).toBeNull();
  });
});

describe('mdaService parent/agency relationship (Story 3.0b)', () => {
  it('CDU has parentMdaId pointing to Agriculture', async () => {
    const cdu = await mdaService.getMdaById(cduMdaId);
    expect(cdu.parentMdaId).toBe(agricultureMdaId);
  });

  it('Agriculture has parentMdaId = null', async () => {
    const agriculture = await mdaService.getMdaById(agricultureMdaId);
    expect(agriculture.parentMdaId).toBeNull();
  });

  it('CDU parentMdaCode is AGRICULTURE', async () => {
    const cdu = await mdaService.getMdaById(cduMdaId);
    expect(cdu.parentMdaCode).toBe('AGRICULTURE');
  });

  it('listMdas response includes parentMdaId and parentMdaCode', async () => {
    const result = await mdaService.listMdas();
    const cdu = result.find((m) => m.code === 'CDU');
    const agriculture = result.find((m) => m.code === 'AGRICULTURE');

    expect(cdu).toBeDefined();
    expect(cdu!.parentMdaId).toBe(agricultureMdaId);
    expect(cdu!.parentMdaCode).toBe('AGRICULTURE');

    expect(agriculture).toBeDefined();
    expect(agriculture!.parentMdaId).toBeNull();
    expect(agriculture!.parentMdaCode).toBeNull();
  });

  it('resolveMdaByName returns parent fields for CDU alias', async () => {
    const cdu = await mdaService.resolveMdaByName('COCOA DEVELOPMENT UNIT');
    expect(cdu).not.toBeNull();
    expect(cdu!.code).toBe('CDU');
    expect(cdu!.parentMdaId).toBe(agricultureMdaId);
    expect(cdu!.parentMdaCode).toBe('AGRICULTURE');
  });

  it('MDAs without parent have null parentMdaCode', async () => {
    const health = await mdaService.getMdaById(healthMdaId);
    expect(health.parentMdaId).toBeNull();
    expect(health.parentMdaCode).toBeNull();
  });

  it('filters by parentMdaId to return sub-agencies', async () => {
    const result = await mdaService.listMdas({ parentMdaId: agricultureMdaId });
    expect(result.length).toBe(1);
    expect(result[0].code).toBe('CDU');
    expect(result[0].parentMdaCode).toBe('AGRICULTURE');
  });
});
