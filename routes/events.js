const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

const requireAuth = passport.authenticate('jwt', { session: false });
const router = express.Router();

const parseCoordinates = (coordinates) => {
  if (coordinates == null) {
    return null;
  }

  let lat;
  let lng;

  if (Array.isArray(coordinates)) {
    if (coordinates.length < 2) {
      return null;
    }
    lng = parseFloat(coordinates[0]);
    lat = parseFloat(coordinates[1]);
  } else if (typeof coordinates === 'object') {
    lat = parseFloat(coordinates.lat ?? coordinates.latitude);
    lng = parseFloat(coordinates.lng ?? coordinates.longitude ?? coordinates.lon);
  } else {
    return null;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    geolocation: { lat, lng },
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  };
};

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, desc, description, coordinates } = req.body;
    const eventDescription = desc ?? description;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Event name is required' });
    }
    if (!eventDescription || !String(eventDescription).trim()) {
      return res.status(400).json({ message: 'Event description is required' });
    }

    const geo = parseCoordinates(coordinates);
    if (!geo) {
      return res.status(400).json({
        message: 'Valid coordinates are required (e.g. { lat, lng } or [lng, lat])',
      });
    }

    const db = getDatabase();
    const eventsCollection = db.collection('events');
    const now = new Date();

    const event = {
      name: String(name).trim(),
      desc: String(eventDescription).trim(),
      geolocation: geo.geolocation,
      location: geo.location,
      createdBy: req.user._id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await eventsCollection.insertOne(event);
    const created = await eventsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ event: created });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Failed to create event' });
  }
});

router.post('/:eventId/signup', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const db = getDatabase();
    const eventsCollection = db.collection('events');
    const signupsCollection = db.collection('event_signups');
    const eventObjectId = new ObjectId(eventId);

    const event = await eventsCollection.findOne({ _id: eventObjectId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const existingSignup = await signupsCollection.findOne({
      eventId: eventObjectId,
      userId: req.user._id,
    });
    if (existingSignup) {
      return res.status(409).json({ message: 'Already signed up for this event' });
    }

    const signup = {
      eventId: eventObjectId,
      userId: req.user._id,
      signedUpAt: new Date(),
    };

    const result = await signupsCollection.insertOne(signup);
    const createdSignup = await signupsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ signup: createdSignup });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Already signed up for this event' });
    }
    console.error('Error signing up for event:', error);
    res.status(500).json({ message: 'Failed to sign up for event' });
  }
});

module.exports = router;
