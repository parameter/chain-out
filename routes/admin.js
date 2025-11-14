const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Path to the badges JSON file
const BADGES_FILE_PATH = path.join(__dirname, '../data/badges.json');

// Helper function to read badges from database
async function readBadgesFromDatabase() {
    try {
        const db = getDatabase();
        const badgesCollection = db.collection('badgeDefinitions');
        
        // Get the single document containing all badges
        const result = await badgesCollection.find({}).toArray();

        console.log(result);
        
        return result;
    } catch (error) {
        console.error('Error reading badges from database:', error);
        return [];
    }
}

// Helper function to read test data from database
async function readTestDataFromDatabase() {
    try {
        const db = getDatabase();
        const badgesCollection = db.collection('badgeDefinitions');
        
        // Get the single document containing test data
        const result = await badgesCollection.findOne({ type: 'badges' });
        
        if (result && result['test-data']) {
            return result['test-data'];
        }
        
        return [];
    } catch (error) {
        console.error('Error reading test data from database:', error);
        return [];
    }
}

// Helper function to write badges to database
async function writeBadgesToDatabase(badges, testData = null) {
    try {
        const db = getDatabase();
        const badgesCollection = db.collection('badgeDefinitions');
        
        // Prepare the document to save
        const document = { type: 'badges', badges: badges };
        
        // Include test-data if provided
        if (testData !== null) {
            document['test-data'] = testData;
        }
        
        // Save as a single document with type identifier
        await badgesCollection.replaceOne(
            { type: 'badges' },
            document,
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error('Error writing badges to database:', error);
        return false;
    }
}

// Helper function to generate unique ID
function generateUniqueId() {
    return 'badge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to ensure all badges have _id
function ensureBadgeIds(badges) {
    return badges.map(badge => {
        if (!badge._id) {
            badge._id = generateUniqueId();
        }
        return badge;
    });
}

// Serve the admin JavaScript file with correct MIME type
router.get('/admin-badges.js', (req, res) => {
    console.log('Serving admin-badges.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, '../public/admin-badges.js'));
});

// Badges are now loaded from JSON file

// Sample test data
const sampleTestData = [
   {
      "playerId": "68da392e41254148ddea8883",
      "holeNumber": 1,
      "score": 3,
      "putt": "inside",
      "obCount": 0,
      "specifics": {
         "c1": false,
         "c2": false,
         "bullseye": false,
         "scramble": false,
         "throwIn": false
      },
      "timestamp": new Date("2025-01-15T10:15:16.467Z")
   },
   {
      "playerId": "68da9fd3ad9d2c0697e59cd3",
      "holeNumber": 1,
      "score": 4,
      "putt": "inside",
      "obCount": 0,
      "specifics": {
         "c1": false,
         "c2": false,
         "bullseye": false,
         "scramble": false,
         "throwIn": false
      },
      "timestamp": new Date("2025-01-15T10:15:19.784Z")
   }
];

// Sample layout data
const sampleLayout = {
   holes: [
      { number: 1, par: 3 },
      { number: 2, par: 4 },
      { number: 3, par: 3 },
      { number: 4, par: 4 },
      { number: 5, par: 3 },
      { number: 6, par: 4 },
      { number: 7, par: 3 },
      { number: 8, par: 4 },
      { number: 9, par: 3 }
   ]
};

// GET /admin/badges - Admin page for testing and editing badges
router.get('/badges', (req, res) => {
   res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Badge Admin Panel</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 20px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        }
        .section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .badge-list {
            display: grid;
            gap: 15px;
        }
        .badge-item {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
        }
        .badge-item.done {
            border: 3px solid #28a745;
            background: #f0fff4;
        }
        .badge-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .badge-name {
            font-weight: bold;
            color: #333;
        }
        .badge-actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5a6fd8;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #5a6268;
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .btn-warning {
            background: #ffc107;
            color: #212529;
        }
        .btn-warning:hover {
            background: #e0a800;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #218838;
        }
        .btn-info {
            background: #17a2b8;
            color: white;
        }
        .btn-info:hover {
            background: #138496;
        }
        .test-results {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
        .test-pass {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .test-fail {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .form-group textarea {
            height: 100px;
            resize: vertical;
        }
        .json-editor {
            font-family: monospace;
            font-size: 12px;
            min-height: 200px;
        }
        .hidden {
            display: none;
        }
        
        /* Loader Styles */
        .loader-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }
        
        .loader-content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .loader-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loader-text {
            color: #333;
            font-size: 16px;
            font-weight: 500;
        }
        .test-data-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .test-data-section h4 {
            margin-top: 0;
            color: #495057;
        }
        .json-display {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 200px;
            overflow-y: auto;
        }
        
        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: 5% auto;
            padding: 0;
            border: none;
            border-radius: 8px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .modal-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h2 {
            margin: 0;
            font-size: 24px;
        }
        
        .close {
            color: white;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
        }
        
        .close:hover {
            opacity: 0.7;
        }
        
        .modal-body {
            padding: 30px;
        }
        
        .form-row {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        .form-group textarea {
            min-height: 120px;
        }
        
        .form-group select {
            height: 40px;
        }
        
        .tier-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .tier-section h4 {
            margin-top: 0;
            color: #495057;
        }
        
        .tier-inputs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .tier-inputs .form-group {
            margin-bottom: 0;
        }
        
        .condition-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .condition-section h4 {
            margin-top: 0;
            color: #856404;
        }
        
        .condition-editor {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            min-height: 200px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
						width: 100%;
        }
        
        .modal-footer {
            padding: 20px 30px;
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            border-radius: 0 0 8px 8px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .btn-large {
            padding: 12px 24px;
            font-size: 16px;
        }
        
        .badge-test-section {
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
        }
        
        .badge-test-section h5 {
            margin-top: 0;
            margin-bottom: 10px;
            color: #495057;
        }
        
        .test-input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .test-input-group .form-group {
            flex: 1;
            margin-bottom: 0;
        }
        
        .test-input-group .form-group textarea {
            min-height: 80px;
            font-family: monospace;
            font-size: 12px;
        }
        
        .test-actions {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .test-actions .btn {
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .existing-test-data {
            margin-top: 15px;
            padding: 15px;
            background: #e8f4fd;
            border: 1px solid #b8daff;
            border-radius: 8px;
        }
        
        .existing-test-data h6 {
            margin-top: 0;
            margin-bottom: 10px;
            color: #004085;
        }
        
        .test-data-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .test-data-item {
            padding: 10px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .test-data-item small {
            color: #6c757d;
        }
        
        .btn-sm {
            padding: 4px 8px;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Badge Admin Panel</h1>
            <p>Test, edit, and manage disc golf badge conditions</p>
        </div>

        <button style="align-self: flex-end;justify-self: end;display: flex;margin: 20px;" class="btn btn-success" id="addNewBadgeBtn">+ Add New Badge</button>
        
        <div class="content">

            <!-- Badge Management Section -->
            <div class="section">
                <h3>🎯 Badge Management</h3>
                <div class="badge-list" id="badgeList">
                    <!-- Badges will be loaded here -->
                </div>
                
            </div>

        </div>
    </div>

    <!-- Badge Edit Modal -->
    <div id="badgeEditModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Edit Badge</h2>
                <span class="close" id="closeModal">&times;</span>
            </div>
            <div class="modal-body">
                <form id="badgeEditForm">
                    <!-- Type Selection - Moved to top -->
                    <div class="form-group">
                        <label for="badgeType">Type:</label>
                        <select id="badgeType" name="type">
                            <option value="unique">Unique</option>
                            <option value="tiered">Tiered</option>
                            <option value="secret">Secret</option>
                        </select>
                    </div>
                    
                    <!-- Basic Information -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="badgeId">Badge ID:</label>
                            <input type="text" id="badgeId" name="id" required>
                        </div>
                        <div class="form-group">
                            <label for="badgeName">Badge Name:</label>
                            <input type="text" id="badgeName" name="name" required>
                        </div>
                    </div>
                    
                    
                    <div class="form-group">
                        <label for="badgeQuote">Quote:</label>
                        <textarea id="badgeQuote" name="quote" placeholder="Enter badge quote..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="badgeDescription">Description:</label>
                        <textarea id="badgeDescription" name="description" placeholder="Enter badge description..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="badgeFunctionalDescription">Functional description:</label>
                        <textarea id="badgeFunctionalDescription" name="functionalDescription" placeholder="Enter functional description..."></textarea>
                    </div>
                    
                    <!-- Track Unique Courses -->
                    <div style="flex-direction: row;" class="form-group">
                        <label style="display: flex; flex-direction: row; align-items: center;">
                            <input style="width: auto;" type="checkbox" id="trackUniqueCourses" name="trackUniqueCourses" style="margin-right: 8px;">
                            <p style="margin:0;">Track Unique Courses</p>
                        </label>
                        <small style="display: block; color: #666; margin-top: 5px;">
                            When enabled, this badge will only count progress once per unique course played.
                        </small>
                    </div>
                    
                    <!-- Track tier threshold zync -->
                    <div style="flex-direction: row;" class="form-group">
                        <label style="display: flex; flex-direction: row; align-items: center;">
                            <input style="width: auto;" type="checkbox" id="trackTierThresholdZync" name="trackTierThresholdZync" style="margin-right: 8px;">
                            <p style="margin:0;">Track tier threshold zync</p>
                        </label>
                        <small style="display: block; color: #666; margin-top: 5px;">
                            When enabled, this badge will track tier threshold zync.
                        </small>
                    </div>
                    
                    <!-- Unique Badge Setting -->
                    <div style="flex-direction: row;" class="form-group">
                        <label style="display: flex; flex-direction: row; align-items: center;">
                            <input style="width: auto;" type="checkbox" id="badgeIsUnique" name="isUnique" style="margin-right: 8px;">
                            <p style="margin:0;">Unique</p>
                        </label>
                        <small style="display: block; color: #666; margin-top: 5px;">
                            When enabled, this badge can only be earned once and has no tiers.
                        </small>
                    </div>
                    
                    <!-- Tier, Difficulty and Points (for unique badges) -->
                    <div class="tier-section" id="uniqueBadgeSection" style="display: none;">
                        <h4>Tier, Difficulty and Points</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="badgeTier">Tier:</label>
                                <select id="badgeTier" name="tier">
                                    <option value="bronze">Bronze</option>
                                    <option value="silver">Silver</option>
                                    <option value="gold">Gold</option>
                                    <option value="platinum">Platinum</option>
                                    <option value="diamond">Diamond</option>
                                    <option value="emerald">Emerald</option>
                                    <option value="ruby">Ruby</option>
                                    <option value="cosmic">Cosmic</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="badgeDifficulty">Difficulty:</label>
                                <select id="badgeDifficulty" name="difficulty">
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                    <option value="extreme">Extreme</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="badgeAnimation">Animation:</label>
                                <select id="badgeAnimation" name="animation">
                                    <option value="pulse">Pulse</option>
                                    <option value="bounce">Bounce</option>
                                    <option value="rotate">Rotate</option>
                                    <option value="glow">Glow</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="badgePoints">Points:</label>
                                <input type="number" id="badgePoints" name="points" min="0">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tier Configuration (for tiered badges) -->
                    <div class="tier-section" id="tieredBadgeSection" style="display: none;">
                        <h4>Tier Configuration</h4>
                        <div class="form-group">
                            <label for="tierDescriptionPrefix">Tier Description Prefix:</label>
                            <input type="text" id="tierDescriptionPrefix" name="tierDescriptionPrefix" placeholder="e.g., 'Make'">
                        </div>
                        <div class="form-group">
                            <label for="tierDescriptionSuffix">Tier Description Suffix:</label>
                            <input type="text" id="tierDescriptionSuffix" name="tierDescriptionSuffix" placeholder="e.g., 'birdies'">
                        </div>
                        
                        <div class="tier-inputs">
                            <div class="form-group">
                                <label for="tierThresholds">Tier Thresholds (comma-separated):</label>
                                <input type="text" id="tierThresholds" name="tierThresholds" placeholder="1,5,10,25,50,100,200,500">
                            </div>
                            <div class="form-group">
                                <label for="tierPoints">Tier Points (comma-separated):</label>
                                <input type="text" id="tierPoints" name="tierPoints" placeholder="10,25,50,100,250,500,750,1000">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="tierNames">Tier Names (one per line):</label>
                            <textarea id="tierNames" name="tierNames" rows="8" placeholder="Bronze Badge&#10;Silver Badge&#10;Gold Badge&#10;..."></textarea>
                        </div>
                    </div>
                    
                    <!-- Condition Function -->
                    <div class="condition-section">
                        <h4>Condition Function</h4>
                        <p>Write the JavaScript function that determines when this badge is earned:</p>
                        <textarea id="badgeCondition" name="condition" class="condition-editor" placeholder="(results, layout) => {
    // Your condition logic here
    // Return true/false for unique badges
    // Return number for tiered badges
    return 0;
}"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-large" id="cancelEdit">Cancel</button>
                <button type="button" class="btn btn-primary btn-large" id="saveBadge">Save Badge</button>
            </div>
        </div>
    </div>

    <!-- Loader Overlay -->
    <div id="loaderOverlay" class="loader-overlay">
        <div class="loader-content">
            <div class="loader-spinner"></div>
            <div class="loader-text" id="loaderText">Loading...</div>
        </div>
    </div>

    <script src="/admin-badges.js"></script>
</body>
</html>
   `);
});

// GET /api/badges - Get all badges
router.get('/api/badges', async (req, res) => {
   try {
      const badges = await readBadgesFromDatabase();
      res.json(badges);
   } catch (error) {
      console.error('Error loading badges:', error);
      res.status(500).json({ error: 'Failed to load badges' });
   }
});

// POST /api/badges - Create or update badges
router.post('/api/badges', async (req, res) => {
   try {
      const { badges } = req.body;
      
      if (!Array.isArray(badges)) {
         return res.status(400).json({ error: 'Badges must be an array' });
      }
      
      const success = await writeBadgesToDatabase(badges);
      
      if (success) {
         res.json({ success: true, message: 'Badges updated successfully' });
      } else {
         res.status(500).json({ error: 'Failed to save badges' });
      }
   } catch (error) {
      console.error('Error saving badges:', error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/start-edit - Mark badge as being edited and return latest data
router.post('/api/badges/start-edit', async (req, res) => {
   try {
      console.log('starting badge edit');
      const { badgeId } = req.body;
      
      if (!badgeId) {
         return res.status(400).json({ error: 'Badge ID is required' });
      }
      
      const db = getDatabase();
      const badgesCollection = db.collection('badgeDefinitions');
      
      // Get the latest badge data
      const existingBadge = await badgesCollection.findOne({ _id: new ObjectId(badgeId) });
      
      if (!existingBadge) {
         return res.status(404).json({ error: 'Badge not found' });
      }
      
      // Return the latest badge data
      res.json({ success: true, badge: existingBadge });
      
   } catch (error) {
      console.error('Error starting badge edit:', error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/stop-edit - Clear edit status (no-op, kept for compatibility)
router.post('/api/badges/stop-edit', async (req, res) => {
   try {
      const { badgeId } = req.body;
      
      if (!badgeId) {
         return res.status(400).json({ error: 'Badge ID is required' });
      }
      
      res.json({ success: true, message: 'Edit status cleared' });
      
   } catch (error) {
      console.error('Error stopping badge edit:', error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/save - Save a single badge
router.post('/api/badges/save', async (req, res) => {
   try {
		const { badge, action } = req.body; // action: 'create', 'update', 'delete'
		
		if (!badge) {
			return res.status(400).json({ error: 'Badge data is required' });
		}
		
		const db = getDatabase();
		const badgesCollection = db.collection('badgeDefinitions');
		
		// Ensure an _id for new badges
		const ensureId = (b) => {
			if (!b._id) {
				b._id = 'badge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			}
			return b;
		};
		
		if (action === 'create') {

			// const toInsert = ensureId({ ...badge });

			const result = await badgesCollection.insertOne(
				badge
			);
			return res.json({ success: true, message: 'Badge created successfully', insertedId: result.insertedId || null, id: badge.id });
		}
		
		if (action === 'update') {

            let id = new ObjectId(badge._id);
            delete badge._id;

			const result = await badgesCollection.updateOne(
				{ _id: id },
				{ $set: { ...badge } }
			);
			if (result.matchedCount === 0) {
				return res.status(404).json({ error: 'Badge not found' });
			}
			return res.json({ success: true, message: 'Badge updated successfully' });
		}
		
		if (action === 'delete') {
			if (!badge._id) {
				return res.status(400).json({ error: 'Badge _id is required for delete' });
			}
			// Pull the badge from badges array and associated test data from test-data array
			const result = await badgesCollection.deleteOne(
				{ _id: new ObjectId(badge._id) }
			);
			return res.json({ success: true, message: 'Badge deleted successfully' });
		}
		
		return res.status(400).json({ error: 'Invalid action' });
   } catch (error) {
      console.error(`Error ${req.body.action} badge:`, error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/test-data/save - Save test data for a badge
router.post('/api/badges/test-data/save', async (req, res) => {
   try {
      const { badgeId, testData } = req.body;
      
      if (!badgeId || !testData) {
         return res.status(400).json({ error: 'Badge ID and test data are required' });
      }
      
      // Load existing badges and test data
      const existingBadges = await readBadgesFromDatabase();
      const existingTestData = await readTestDataFromDatabase();
      
      // Add test data with badge association
      const newTestData = {
         ...testData,
         badgeId: badgeId,
         id: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };
      
      existingTestData.push(newTestData);
      
      // Save updated test data
      const success = await writeBadgesToDatabase(existingBadges, existingTestData);
      
      if (success) {
         res.json({ success: true, message: 'Test data saved successfully', testDataId: newTestData.id });
      } else {
         res.status(500).json({ error: 'Failed to save test data' });
      }
   } catch (error) {
      console.error('Error saving test data:', error);
      res.status(500).json({ error: error.message });
   }
});

// GET /api/badges/test-data/:badgeId - Get test data for a specific badge
router.get('/api/badges/test-data/:badgeId', async (req, res) => {
   try {
      const { badgeId } = req.params;
      const testData = await readTestDataFromDatabase();
      
      // Filter test data for this specific badge
      const badgeTestData = testData.filter(td => td.badgeId === badgeId);
      
      res.json(badgeTestData);
   } catch (error) {
      console.error('Error getting test data:', error);
      res.status(500).json({ error: error.message });
   }
});

// DELETE /api/badges/test-data/:badgeId - Clear all test data for a badge
router.delete('/api/badges/test-data/:badgeId', async (req, res) => {
   try {
      const { badgeId } = req.params;
      
      // Load existing badges and test data
      const existingBadges = await readBadgesFromDatabase();
      const existingTestData = await readTestDataFromDatabase();
      
      // Remove test data for this badge
      const filteredTestData = existingTestData.filter(td => td.badgeId !== badgeId);
      
      // Save updated test data
      const success = await writeBadgesToDatabase(existingBadges, filteredTestData);
      
      if (success) {
         res.json({ success: true, message: 'Test data cleared successfully' });
      } else {
         res.status(500).json({ error: 'Failed to clear test data' });
      }
   } catch (error) {
      console.error('Error clearing test data:', error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/test - Test badge conditions
router.post('/api/badges/test', (req, res) => {
   try {
      const { badge, testData, layout } = req.body;
      
      // Create a safe evaluation environment
      const results = testData || [];
      // Ensure that each hole's "number" property is renamed to "holeNumber" in layoutData
      let layoutData = layout || { holes: [] };
      if (layoutData && Array.isArray(layoutData.holes)) {
         layoutData = {
            ...layoutData,
            holes: layoutData.holes.map(hole => {
               if ('number' in hole) {
                  // Copy and rename "number" to "holeNumber"
                  const { number, ...rest } = hole;
                  return { ...rest, holeNumber: number, length: 77, measureInMeters: true };
               }
               return hole;
            })
         };
      }
 
      console.log('badge: ', badge);
 
      // Handle condition field - it might be a string (source code) or function
      let conditionFunction;
      if (typeof badge.condition === 'function') {
         conditionFunction = badge.condition;
      } else if (typeof badge.condition === 'string' || typeof badge.conditionString === 'string') {
         // Try to create a function from the string
         try {
            // Extract function body from string like "function (results, layout) { ... }"

            let condition = badge.condition;
            if (typeof badge.conditionString === 'string') {
                condition = badge.conditionString;
            }

            const trimmed = condition.trim();
            const functionStart = trimmed.indexOf('{');
            const functionEnd = trimmed.lastIndexOf('}');
            
            if (functionStart !== -1 && functionEnd !== -1) {
               const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
               conditionFunction = new Function('results', 'layout', functionBody);
            } else {
               throw new Error('Invalid condition function format');
            }
         } catch (error) {
            throw new Error(`Invalid condition function: ${error.message}`);
         }
      } else {
         throw new Error('Condition field is missing or invalid');
      }
      
      // Test the condition function
      const result = conditionFunction(results, layoutData);
      
      res.json({
         success: true,
         result: result,
         resultType: typeof result,
         timestamp: new Date().toISOString()
      });
   } catch (error) {
      res.status(500).json({
         success: false,
         error: error.message,
         timestamp: new Date().toISOString()
      });
   }
});

module.exports = router;

