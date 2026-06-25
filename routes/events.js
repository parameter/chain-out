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

const eventSignupsWithUsersLookup = {
  $lookup: {
    from: 'event_signups',
    let: { eventId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$eventId', '$$eventId'] } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: 1,
          signedUpAt: 1,
          user: {
            _id: '$user._id',
            username: '$user.username',
            email: '$user.email',
            profileImage: '$user.profileImage',
            fname: '$user.fname',
            sname: '$user.sname',
          },
        },
      },
    ],
    as: 'participants',
  },
};

const creatorLookup = [
  {
    $lookup: {
      from: 'users',
      localField: 'createdBy',
      foreignField: '_id',
      as: 'creator',
    },
  },
  {
    $unwind: {
      path: '$creator',
      preserveNullAndEmptyArrays: true,
    },
  },
];



router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, desc, courseId, courseName, location, maximumPlayers, startDate, endDate } = req.body;
    const eventDescription = desc;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Event name is required' });
    }
    if (!eventDescription || !String(eventDescription).trim()) {
      return res.status(400).json({ message: 'Event description is required' });
    }

    /*
    const geo = parseCoordinates(coordinates);
    if (!geo) {
      return res.status(400).json({
        message: 'Valid coordinates are required (e.g. { lat, lng } or [lng, lat])',
      });
    } */

    const db = getDatabase();
    const eventsCollection = db.collection('events');
    const now = new Date();

    const event = {
      name: String(name).trim(),
      desc: String(eventDescription).trim(),
      location: location,
      createdBy: req.user._id,
      maximumPlayers: maximumPlayers,
      courseId: courseId,
      courseName: courseName,
      createdAt: now,
      updatedAt: now,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
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



router.get('/', requireAuth, async (req, res) => {
  try {
    const { location } = req.params;

    const db = getDatabase();
    const eventsCollection = db.collection('events');
    const createdBy = new ObjectId(req.user._id);

    // const maxDistance = 100 * 1000; to get events near a location

    if (location) {
      const [lat, lng] = location.split(',');
      const maxDistance = 100 * 1000; // 100km in meters

      var matchStage = {};
      
      matchStage.location = {
        $nearSphere: {
          $geometry: { 
            type: 'Point', 
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: maxDistance
        }
      };
    }

    const events = await eventsCollection
      .aggregate([
        { $match: matchStage },
        eventSignupsWithUsersLookup,
        ...creatorLookup
      ])
      .toArray();

    res.json({ events });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});



router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const db = getDatabase();
    const eventsCollection = db.collection('events');
    const eventObjectId = new ObjectId(eventId);

    const [event] = await eventsCollection
      .aggregate([{ $match: { _id: eventObjectId } }, eventSignupsWithUsersLookup, ...creatorLookup])
      .toArray();

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});



module.exports = router;
