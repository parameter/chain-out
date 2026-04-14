const express = require('express');
const path = require('path');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const {
  emitCondition,
  dryRunRound,
  dryRunHistorical,
  inferBuilderFromCondition,
  catalog
} = require('../lib/badgeConditionCodegen');

const router = express.Router();

router.get('/badge-builder', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-badge-builder.html'));
});

router.get('/api/badge-builder/templates', (req, res) => {
  res.json({ templates: catalog });
});

/** Emit condition string + builder state (for client preview / test). */
router.post('/api/badge-builder/emit', (req, res) => {
  try {
    const { mode, templateId, params } = req.body;
    const out = emitCondition({ mode, templateId, params: params || {} });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** List badge definition documents (excludes embedded `type: 'badges'` aggregate doc). */
router.get('/api/badge-builder/badges', async (req, res) => {
  try {
    const db = getDatabase();
    const docs = await db
      .collection('badgeDefinitions')
      .find({ id: { $exists: true } })
      .sort({ name: 1 })
      .toArray();
    res.json(docs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/badge-builder/badge/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const col = db.collection('badgeDefinitions');

    let doc = null;
    if (ObjectId.isValid(id) && String(id).length === 24) {
      doc = await col.findOne({ _id: new ObjectId(id) });
    }
    if (!doc) {
      doc = await col.findOne({ id });
    }
    if (!doc) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    const infer = inferBuilderFromCondition(
      doc.conditionBuilder,
      doc.condition,
      !!doc.requiresHistoricalData
    );

    res.json({
      badge: doc,
      inferStatus: infer.status,
      inferReason: infer.reason || null,
      conditionBuilder:
        infer.status === 'known' ? infer.conditionBuilder : doc.conditionBuilder || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/badge-builder/save', async (req, res) => {
  try {
    const { action, badgeMetadata, conditionBuilder } = req.body;
    if (!badgeMetadata || !conditionBuilder) {
      return res.status(400).json({ error: 'badgeMetadata and conditionBuilder are required' });
    }

    const mode = conditionBuilder.mode;
    const templateId = conditionBuilder.templateId;
    const params = conditionBuilder.params || {};

    let emitted;
    try {
      emitted = emitCondition({ mode, templateId, params });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    try {
      if (mode === 'round') {
        dryRunRound(emitted.condition);
      } else {
        dryRunHistorical(emitted.condition);
      }
    } catch (e) {
      return res.status(400).json({ error: `Condition validation failed: ${e.message}` });
    }

    const requiresHistoricalData = mode === 'historical';

    if (!badgeMetadata.id || !String(badgeMetadata.id).trim()) {
      return res.status(400).json({ error: 'Badge id is required' });
    }
    if (!badgeMetadata.name || !String(badgeMetadata.name).trim()) {
      return res.status(400).json({ error: 'Badge name is required' });
    }

    const badge = {
      ...badgeMetadata,
      condition: emitted.condition,
      conditionBuilder: emitted.conditionBuilder,
      requiresHistoricalData
    };

    if (badge.done === undefined) badge.done = false;

    const db = getDatabase();
    const badgesCollection = db.collection('badgeDefinitions');

    if (action === 'create') {
      const result = await badgesCollection.insertOne(badge);
      return res.json({
        success: true,
        message: 'Badge created',
        insertedId: result.insertedId,
        id: badge.id
      });
    }

    if (action === 'update') {
      if (!badge._id) {
        return res.status(400).json({ error: '_id required for update' });
      }
      const oid = new ObjectId(badge._id);
      delete badge._id;
      const result = await badgesCollection.updateOne({ _id: oid }, { $set: badge });
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Badge not found' });
      }
      return res.json({ success: true, message: 'Badge updated' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
