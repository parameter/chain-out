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
        const result = await badgesCollection.findOne({ type: 'badges' });

				console.log('result', result);
        
        if (result && result.badges) {
            return result.badges;
        }
        
        // If no badges found, try to load from JSON file and initialize
        try {
            const data = await fs.readFile(BADGES_FILE_PATH, 'utf8');
            const badges = JSON.parse(data);
            
            // Save to database for future use
            await writeBadgesToDatabase(badges);
            return badges;
        } catch (fileError) {
            console.log('No badges file found, starting with empty array');
            return [];
        }
    } catch (error) {
        console.error('Error reading badges from database:', error);
        return [];
    }
}

// Helper function to write badges to database
async function writeBadgesToDatabase(badges) {
    try {
        const db = getDatabase();
        const badgesCollection = db.collection('badgeDefinitions');
        
        // Save as a single document with type identifier
        await badgesCollection.replaceOne(
            { type: 'badges' },
            { type: 'badges', badges: badges },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error('Error writing badges to database:', error);
        return false;
    }
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
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #218838;
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Badge Admin Panel</h1>
            <p>Test, edit, and manage disc golf badge conditions</p>
        </div>
        
        <div class="content">

            <!-- Badge Management Section -->
            <div class="section">
                <h3>🎯 Badge Management</h3>
                <div class="badge-list" id="badgeList">
                    <!-- Badges will be loaded here -->
                </div>
                <button class="btn btn-success" id="addNewBadgeBtn">+ Add New Badge</button>
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
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="badgeIcon">Icon:</label>
                            <input type="text" id="badgeIcon" name="icon">
                        </div>
                        <div class="form-group">
                            <label for="badgeType">Type:</label>
                            <select id="badgeType" name="type">
                                <option value="allRounds">All Rounds</option>
                                <option value="lastRound">Last Round</option>
                                <option value="courseSpecific">Course Specific</option>
                            </select>
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
                    
                    <!-- Badge Properties -->
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
                    
                    
                    <!-- Tier Information (for non-unique badges) -->
                    <div class="tier-section" id="tierSection">
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
    return results.length > 0;
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

// POST /api/badges/save - Save a single badge
router.post('/api/badges/save', async (req, res) => {
   try {
      const { badge, action } = req.body; // action: 'create', 'update', 'delete'
      
      if (!badge) {
         return res.status(400).json({ error: 'Badge data is required' });
      }
      
      // Load existing badges
      const existingBadges = await readBadgesFromDatabase();
      
      if (action === 'create') {
         // Add new badge
         existingBadges.push(badge);
      } else if (action === 'update') {
         // Update existing badge
         const index = existingBadges.findIndex(b => b.id === badge.id);
         if (index !== -1) {
            existingBadges[index] = badge;
         } else {
            return res.status(404).json({ error: 'Badge not found' });
         }
      } else if (action === 'delete') {
         // Remove badge
         const filteredBadges = existingBadges.filter(b => b.id !== badge.id);
         const success = await writeBadgesToDatabase(filteredBadges);
         
         if (success) {
            res.json({ success: true, message: 'Badge deleted successfully' });
         } else {
            res.status(500).json({ error: 'Failed to delete badge' });
         }
         return;
      }
      
      // Save updated badges
      const success = await writeBadgesToDatabase(existingBadges);
      
      if (success) {
         res.json({ success: true, message: `Badge ${action}d successfully` });
      } else {
         res.status(500).json({ error: `Failed to ${action} badge` });
      }
   } catch (error) {
      console.error(`Error ${req.body.action} badge:`, error);
      res.status(500).json({ error: error.message });
   }
});

// POST /api/badges/test - Test badge conditions
router.post('/api/badges/test', (req, res) => {
   try {
      const { badge, testData, layout } = req.body;
      
      // Create a safe evaluation environment
      const results = testData || [];
      const layoutData = layout || { holes: [] };
      
      // Test the condition function
      const result = badge.condition(results, layoutData);
      
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

