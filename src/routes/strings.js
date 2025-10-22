const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { analyzeString, sha256 } = require('../services/analyzer');
const { parseNaturalLanguage } = require('../services/nlp');

const router = express.Router();

// Schemas
const createSchema = z.object({
  value: z.string({ required_error: '"value" is required' }),
});

const listQuerySchema = z.object({
  is_palindrome: z.string().optional()
    .transform(v => (v == null ? undefined : v === 'true')),
  min_length: z.string().optional()
    .transform(v => (v == null ? undefined : Number(v)))
    .refine(v => v == null || Number.isInteger(v), { message: 'min_length must be an integer' }),
  max_length: z.string().optional()
    .transform(v => (v == null ? undefined : Number(v)))
    .refine(v => v == null || Number.isInteger(v), { message: 'max_length must be an integer' }),
  word_count: z.string().optional()
    .transform(v => (v == null ? undefined : Number(v)))
    .refine(v => v == null || Number.isInteger(v), { message: 'word_count must be an integer' }),
  contains_character: z.string().optional()
    .refine(v => v == null || v.length === 1, { message: 'contains_character must be a single character' }),
});

// helper: DB row -> API spec
function recordToApi(row) {
  return {
    id: row.id,
    value: row.value,
    properties: {
      length: row.length,
      is_palindrome: row.is_palindrome,
      unique_characters: row.unique_characters,
      word_count: row.word_count,
      sha256_hash: row.id,
      character_frequency_map: row.character_frequency_map,
    },
    created_at: row.created_at.toISOString(),
  };
}

// POST /strings — Create/Analyze
router.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body or missing "value" field' });
    }

    const value = parsed.data.value;
    const id = sha256(value);

    // Conflict if exists
    const existing = await prisma.stringItem.findUnique({ where: { id } });
    if (existing) {
      return res.status(409).json({ error: 'String already exists in the system' });
    }

    const analysis = analyzeString(value);

    // Persist (include all required fields)
    await prisma.stringItem.create({
      data: {
        id: analysis.id,
        value: analysis.value,
        length: analysis.properties.length,
        is_palindrome: analysis.properties.is_palindrome,
        unique_characters: analysis.properties.unique_characters,
        word_count: analysis.properties.word_count,
        character_frequency_map: analysis.properties.character_frequency_map,
        created_at: new Date(analysis.created_at),
      },
    });

    // Return the spec object, not the raw DB row
    return res.status(201).json(analysis);
  } catch (error) {
    return next(error);
  }
});

// GET /strings/filter-by-natural-language
router.get('/filter-by-natural-language', async (req, res, next) => {
  try {
    const { parsed, errors, notes } = parseNaturalLanguage(req.query.query);
    if (errors && errors.length) {
      const status = errors[0].includes('Conflicting') ? 422 : 400;
      return res.status(status).json({ error: errors[0] });
    }
    const { is_palindrome, min_length, max_length, word_count, contains_character } = parsed;
    const where = {};
    if (is_palindrome != null) where.is_palindrome = is_palindrome;
    if (word_count != null) where.word_count = { equals: word_count };
    if (min_length != null || max_length != null) {
      where.length = {};
      if (min_length != null) where.length.gte = min_length;
      if (max_length != null) where.length.lte = max_length;
    }
    if (contains_character != null) {
      where.value = { contains: String(contains_character), mode: 'insensitive' };
    }
    const rows = await prisma.stringItem.findMany({ where, orderBy: { created_at: 'desc' } });
    return res.json({
      data: rows.map(recordToApi),
      count: rows.length,
      interpreted_query: {
        original: String(req.query.query || ''),
        parsed_filters: parsed,
        notes,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /strings — list with filters
router.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameter values or types' });
    }
    const { is_palindrome, min_length, max_length, word_count, contains_character } = parsed.data;
    if (min_length != null && max_length != null && min_length > max_length) {
      return res.status(422).json({ error: 'Query parsed but resulted in conflicting filters' });
    }
    const where = {};
    if (is_palindrome != null) where.is_palindrome = is_palindrome;
    if (word_count != null) where.word_count = { equals: word_count };
    if (min_length != null || max_length != null) {
      where.length = {};
      if (min_length != null) where.length.gte = min_length;
      if (max_length != null) where.length.lte = max_length;
    }
    if (contains_character != null) {
      where.value = { contains: String(contains_character), mode: 'insensitive' };
    }
    const rows = await prisma.stringItem.findMany({ where, orderBy: { created_at: 'desc' } });
    return res.json({
      data: rows.map(recordToApi),
      count: rows.length,
      filters_applied: {
        ...(is_palindrome == null ? {} : { is_palindrome }),
        ...(min_length == null ? {} : { min_length }),
        ...(max_length == null ? {} : { max_length }),
        ...(word_count == null ? {} : { word_count }),
        ...(contains_character == null ? {} : { contains_character }),
      },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /strings/:string_value — exact by value (URL-encoded)
router.get('/:string_value', async (req, res, next) => {
  try {
    const value = decodeURIComponent(req.params.string_value);
    const row = await prisma.stringItem.findUnique({ where: { value } });
    if (!row) return res.status(404).json({ error: 'String does not exist in the system' });
    return res.json(recordToApi(row));
  } catch (err) {
    return next(err);
  }
});

// DELETE /strings/:string_value
router.delete('/:string_value', async (req, res, next) => {
  try {
    const value = decodeURIComponent(req.params.string_value);
    const deleted = await prisma.stringItem.deleteMany({ where: { value } });
    if (deleted.count === 0) return res.status(404).json({ error: 'String does not exist in the system' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
