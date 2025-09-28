const express = require('express');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const { getPresignedPutUrl, getPresignedGetUrl } = require('../utils/s3');

const router = express.Router();

const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
};

router.get('/profile', requireAuth, (req, res) => {
  res.json({
    _id: req.user._id,
    email: req.user.email,
    name: req.user.name
  });
});

router.get('/issuer/service-users', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const serviceUsersCollection = db.collection('service-users');

    const serviceUsers = await serviceUsersCollection
      .find({ issuing_user_id: req.user._id, invite_status: 'accepted' })
      .sort({ created_at: -1 })
      .project({ email: 1, company: 1 })
      .toArray();

    res.json(serviceUsers);

  } catch (error) {
    console.error('Error fetching service users:', error);
    res.status(500).json({ message: 'Failed to load service users' });
  }
});

router.get('/issuer/jobs', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    const jobs = await jobsCollection
      .find({ issuing_user_id: req.user._id })
      .sort({ created_at: -1 })
      .toArray();

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'Failed to load jobs' });
  }
});

router.post('/issuer/jobs', requireAuth, async (req, res) => {
  try {
    const { title, description, service_user_id, location, imageKeys, ordernumber } = req.body;
    const from_date = req.body['from-date'];
    const to_date = req.body['to-date'];

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    const doc = {
      issuing_user_id: req.user._id,
      title: title.trim(),
      description: typeof description === 'string' ? description : '',
      service_user_id: service_user_id,
      created_at: new Date(),
      updated_at: new Date(),
      location: location ? location : null,
      image_keys: Array.isArray(imageKeys) ? imageKeys : [],
      ordernumber: ordernumber ? ordernumber : null,
      from_date: from_date ? from_date : null,
      to_date: to_date ? to_date : null,
      offer: null,
      offer_date: null,
      offer_status: null
    };

    const result = await jobsCollection.insertOne(doc);

    res.status(201).json({
      message: 'Job added successfully',
      id: result.insertedId
    });
  } catch (error) {
    console.error('Error adding job:', error);
    res.status(500).json({ message: 'Failed to add job' });
  }
});

router.delete('/issuer/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job id' });
    }

    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    const result = await jobsCollection.deleteOne({
      _id: new ObjectId(id),
      user_id: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Failed to delete job' });
  }
});

router.post('/issuer/invite-service-user', requireAuth, async (req, res) => {
  try {
    const { email, company } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const db = getDatabase();
    const serviceUsersCollection = db.collection('service-users');

    const existingServiceUser = await serviceUsersCollection.findOne({ email: email.trim() });

    if (existingServiceUser) {
      return res.status(400).json({ message: 'Service user already exists' });
    }

    // Generate a unique id for the invite (can be used in email links)
    const inviteId = new ObjectId();

    const doc = {
      _id: inviteId,
      issuing_user_id: req.user._id,
      email: email.trim(),
      company: company ? company.trim() : '',
      created_at: new Date(),
      invite_id: inviteId.toHexString(),
      password: "$2a$10$bLrw9AFHJ5km1t4LzjMZ5..w2pfqnMmf07C6rKWG36nuV0TObl0vW",
      // invite_status: 'pending'
      invite_status: 'accepted'
    };

    const result = await serviceUsersCollection.insertOne(doc);

    res.status(201).json({
      message: 'Service user invited successfully',
      id: inviteId
    });

  } catch (error) {
    console.error('Error inviting service user:', error);
    res.status(500).json({ message: 'Failed to invite service user' });
  }
});

router.post('/issuer/accept-client-invite', requireAuth, async (req, res) => {
  try {
    const { inviteId } = req.body;

    if (!ObjectId.isValid(inviteId)) {
      return res.status(400).json({ message: 'Invalid invite id' });
    }

    const db = getDatabase();
    const clientsCollection = db.collection('clients');

    const result = await clientsCollection.updateOne({
      _id: new ObjectId(inviteId),
      invite_status: 'accepted',
      accepted_at: new Date()
    });

    res.json({ message: 'Client invite accepted successfully' });

  } catch (error) {
    console.error('Error accepting client invite:', error);
    res.status(500).json({ message: 'Failed to accept client invite' });
  }
});

router.get('/service-user/jobs', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    const jobs = await jobsCollection.aggregate([
      { $match: { service_user_id: req.user._id.toString() } },
      { $sort: { created_at: -1 } },
      {
        $lookup: {
          from: 'operators',
          let: { assignedIds: '$assigned_operators' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$assignedIds', []] }] } } },
            { $project: { name: 1, email: 1 } }
          ],
          as: 'assigned_operators'
        }
      },
      { $project: { title: 1, description: 1, assigned_operators: 1, location: 1, image_keys: 1, offer: 1, offer_date: 1, offer_status: 1, offer_accepted: 1, offer_accepted_at: 1, ordernumber: 1, from_date: 1, to_date: 1 } }
    ]).toArray();

    res.json(jobs);
    
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Failed to load clients' });
  }
});

router.post('/issuer/jobs/:id/accept-offer', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { offerPrice } = req.body;

    const db = getDatabase();
    const jobsCollection = db.collection('jobs');
    
    const job = await jobsCollection.findOne({ _id: new ObjectId(id), issuing_user_id: req.user._id });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id), issuing_user_id: req.user._id },
      { $set: { offer_accepted: true, offer_accepted_at: new Date() } }
    );

    res.json({ message: 'Offer accepted successfully' });

  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ message: 'Failed to accept offer' });
  }
});
 
router.get('/service-user/operators', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const operatorsCollection = db.collection('operators');

    const operators = await operatorsCollection
      .find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .project({ name: 1, email: 1 })
      .toArray();

    res.json(operators);
    
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(500).json({ message: 'Failed to load operators' });
  }
});

router.post('/service-user/jobs/:jobId/offer', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { offerPrice } = req.body;

    if (!jobId) {
      return res.status(400).json({ message: 'Invalid job id' });
    }

    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    console.log(jobId);
    console.log(offerPrice);
    console.log(req.user._id);

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(jobId), service_user_id: req.user._id.toString() },
      { $set: { offer: offerPrice, offer_date: new Date(), offer_status: 'pending' } }
    );

    console.log(result);

    /*
    await pusher.trigger(
      req.user._id,
      'user-notifications',
      {
        message: 'A new offer has been posted for you.',
        jobId: jobId
      }
    ); */

    res.json({ message: 'Offer posted successfully' });

  } catch (error) {
    console.error('Error posting offer:', error);
    res.status(500).json({ message: 'Failed to post offer' });
  }
});

router.post('/service-user/jobs/:id/assign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job id' });
    }

    if (!ObjectId.isValid(operatorId)) {
      return res.status(400).json({ message: 'Invalid operator id' });
    }

    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    const result = await jobsCollection.updateOne(
      {
        _id: new ObjectId(id),
        service_user_id: req.user._id.toString()
      },
      {
        $push: {
          assigned_operators: new ObjectId(operatorId)
        }
      }
    );

    console.log(result); 

    await pusher.trigger(
      operatorId,
      'user-notifications',
      {
        message: 'A new job has been assigned to you.',
        jobId: id
      }
    );

    res.json({ message: 'Job assigned successfully' });

  } catch (error) {
    console.error('Error assigning job:', error);
    res.status(500).json({ message: 'Failed to assign job' });
  }
});

router.post('/client/invite-operator', requireAuth, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const db = getDatabase();
    const operatorsCollection = db.collection('operators');

    const existingOperator = await operatorsCollection.findOne({ email: email.trim() });

    if (existingOperator) {
      return res.status(400).json({ message: 'Operator already exists' });
    }

    // Generate a unique id for the invite (can be used in email links)
    const inviteId = new ObjectId();

    const doc = {
      _id: inviteId,
      user_id: req.user._id,
      email: email.trim(),
      name: name ? name.trim() : '',
      created_at: new Date(),
      invite_id: inviteId.toHexString(),
      password: "$2a$10$bLrw9AFHJ5km1t4LzjMZ5..w2pfqnMmf07C6rKWG36nuV0TObl0vW", // ytrewq666
      // invite_status: 'pending'
      invite_status: 'accepted'
    };

    const result = await operatorsCollection.insertOne(doc);

    res.status(201).json({
      message: 'Operator invited successfully',
      id: inviteId
    });

  } catch (error) {
    console.error('Error inviting operator:', error);
    res.status(500).json({ message: 'Failed to invite operator' });
  }
});

router.get('/operator/jobs', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    console.log(req.user._id);

    const jobs = await jobsCollection
      .find({ assigned_operators: { $in: [new ObjectId(req.user._id)] } })
      .sort({ created_at: -1 })
      .toArray();

    res.json(jobs);

  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'Failed to load jobs' });
  }
});

router.get('/operator/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const jobsCollection = db.collection('jobs');
    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    res.json(job);

  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Failed to load job' });
  }
});

router.post('/operator/job-actions/:id/:action', requireAuth, async (req, res) => {
  try {
    const { id, action } = req.params;
    const { location } = req.body;
    const db = getDatabase();
    const jobsCollection = db.collection('jobs');

    if (!['start', 'pause', 'finish'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Initialize time tracking array if not present
    let timeTracking = Array.isArray(job.time_tracking) ? job.time_tracking : [];

    // Helper to get current ISO time
    const now = new Date().toISOString();

    let update = { status: action };

    if (action === 'start') {
      // Only add a new "from" if not already started (i.e., last entry is a "to" or array is empty)
      if (
        timeTracking.length === 0 ||
        (timeTracking[timeTracking.length - 1] && timeTracking[timeTracking.length - 1].to)
      ) {
        timeTracking.push({ from: { time: now, location: location || null } });
      }
    } else if (action === 'pause') {
      // Only add a new "to" if last entry is a "from" (not a "to")
      if (
        timeTracking.length > 0 &&
        timeTracking[timeTracking.length - 1] &&
        timeTracking[timeTracking.length - 1].from &&
        !timeTracking[timeTracking.length - 1].to
      ) {
        timeTracking.push({ to: { time: now, location: location || null } });
      }
    } else if (action === 'finish') {
      // If job is running (last entry is a "from" and not a "to"), close it with a "to"
      if (
        timeTracking.length > 0 &&
        timeTracking[timeTracking.length - 1] &&
        timeTracking[timeTracking.length - 1].from &&
        !timeTracking[timeTracking.length - 1].to
      ) {
        timeTracking.push({ to: { time: now, location: location || null } });
      }
    }

    update.time_tracking = timeTracking;

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (!result.acknowledged) {
      return res.status(404).json({ message: 'Job not found or not updated' });
    }

    res.json({ message: 'Job updated successfully', timeTracking: timeTracking });

  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Failed to update job' });
  }
});

router.post('/operator/jobs/:id/log-location', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const db = getDatabase();
    const operatorJobLogsCollection = db.collection('operator-job-logs');

    await operatorJobLogsCollection.updateOne(
      { job_id: new ObjectId(id) },
      { $push: { 
        logs: {
          location: location,
          time: new Date().toISOString(),
          operator_id: req.user._id
        }
      }},
      { upsert: true }
    );
    
    res.json({ message: 'Location logged successfully' });
  
  } catch (error) {
    console.error('Error logging location:', error);
    res.status(500).json({ message: 'Failed to log location' });
  }
});

// Presign a PUT URL for uploading a single file
router.post('/uploads/presign', requireAuth, async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ message: 'fileName and contentType are required' });
    }
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `jobs/${req.user._id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
    const data = await getPresignedPutUrl(key, contentType, 900); // 15 min
    res.json(data); // { key, url }
  } catch (e) {
    console.error('Error presigning upload:', e);
    res.status(500).json({ message: 'Failed to presign upload' });
  }
});

router.get('/uploads/file-url', requireAuth, async (req, res) => {
  try {
    const { key, expires } = req.query;
    if (!key) return res.status(400).json({ message: 'key is required' });
    const ttl = Number(expires) || 900;
    const data = await getPresignedGetUrl(key, ttl); // { key, url }
    res.json(data);
  } catch (e) {
    console.error('Error presigning get url:', e);
    res.status(500).json({ message: 'Failed to presign file url' });
  }
});

module.exports = router;