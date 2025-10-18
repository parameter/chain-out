const express = require('express');
const passport = require('passport');
const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');

const router = express.Router();

// Serve static files from public directory
router.use(express.static(path.join(__dirname, '../public')));

// Sample badge definitions for testing
const sampleBadges = [
   {
      id: "birdie_hunter",
      name: "Birdie Hunter",
      quote: "You're a true predator of the fairway, hunting down birdies with skill and precision.",
      icon: "birdiehunter",
      isUnique: false,
      type: "allRounds",
      tier: "bronze",
      tierNames: [
         "Birdie Hunter",
         "Birdie Pioneer",
         "Birdie Master",
         "Birdie Legend",
         "Birdie Trailblazer",
         "Birdie Conqueror",
         "Birdie Champion",
         "Birdie Grandmaster",
      ],
      tierThresholds: [5, 50, 100, 500, 1000, 2000, 5000, 10000],
      tierPoints: [10, 25, 50, 100, 250, 500, 750, 1000],
      tierDescriptionPrefix: "Make",
      tierDescriptionSuffix: "birdies",
      difficulty: [
         "easy",
         "easy",
         "easy",
         "medium",
         "medium",
         "hard",
         "hard",
         "extreme",
      ],
      animation: "pulse",
      condition: (results, layout) => {
         const birdies = results.filter((r) => {
            const hole = layout.holes.find((h) => h.number === r.holeNumber);
            return hole && r.score === hole.par - 1;
         }).length;
         return birdies;
      },
   },
   {
      id: "eagle_man",
      name: "Eagle Man",
      quote: "You just caught a really rare bird man, be proud of yourself!",
      description: "Score your first eagle",
      icon: "eagle-man",
      isUnique: true,
      type: "lastRound",
      unlockCondition: 1,
      tier: "diamond",
      difficulty: "hard",
      points: 500,
      animation: "glow",
      condition: (results, layout) =>
         results.some((r) => {
            const hole = layout.holes.find((h) => h.number === r.holeNumber);
            return hole && r.score !== 1 && r.score === hole.par - 2;
         }),
   },
   {
      id: "basket_marksman",
      name: "Basket Marksman",
      quote: "You just found the holy grale of disc golf, now that's something to tell the kids about.",
      icon: "basket-marksman",
      isUnique: false,
      type: "allRounds",
      tierNames: [
         "Ace Hunter",
         "Ace Pioneer",
         "Ace Master",
         "Ace Legend",
         "Ace Trailblazer",
         "Ace Conqueror",
         "Ace Champion",
         "Ace Grandmaster",
      ],
      tierThresholds: [1, 5, 10, 25, 50, 75, 100, 200],
      tierPoints: [25, 50, 100, 250, 500, 750, 1000, 1250],
      difficulty: [
         "easy",
         "medium",
         "medium",
         "medium",
         "hard",
         "hard",
         "extreme",
         "extreme",
      ],
      tier: "cosmic",
      animation: "glow",
      condition: (results) =>
         results.some((r) => r.score === 1 && r.isAce === true),
   }
];

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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Badge Admin Panel</h1>
            <p>Test, edit, and manage disc golf badge conditions</p>
        </div>
        
        <div class="content">
            <!-- Test Data Section -->
            <div class="section">
                <h3>📊 Test Data</h3>
                <div class="test-data-section">
                    <h4>Sample Round Results:</h4>
                    <div class="json-display" id="testResultsDisplay"></div>
                    <button class="btn btn-secondary" onclick="loadSampleData()">Load Sample Data</button>
                    <button class="btn btn-primary" onclick="editTestData()">Edit Test Data</button>
                </div>
                
                <div class="test-data-section">
                    <h4>Sample Layout:</h4>
                    <div class="json-display" id="testLayoutDisplay"></div>
                    <button class="btn btn-secondary" onclick="loadSampleLayout()">Load Sample Layout</button>
                    <button class="btn btn-primary" onclick="editTestLayout()">Edit Test Layout</button>
                </div>
            </div>

            <!-- Badge Management Section -->
            <div class="section">
                <h3>🎯 Badge Management</h3>
                <div class="badge-list" id="badgeList">
                    <!-- Badges will be loaded here -->
                </div>
                <button class="btn btn-success" onclick="addNewBadge()">+ Add New Badge</button>
            </div>

            <!-- Test All Badges Section -->
            <div class="section">
                <h3>🧪 Test All Badges</h3>
                <button class="btn btn-primary" onclick="testAllBadges()">Test All Badges</button>
                <div id="allTestResults"></div>
            </div>
        </div>
    </div>

    <script src="/admin-badges.js"></script>
</body>
</html>
   `);
});

// GET /api/admin/badges - Get all badges
router.get('/api/admin/badges', (req, res) => {
   res.json(sampleBadges);
});

// POST /api/admin/badges - Create or update badges
router.post('/api/admin/badges', (req, res) => {
   try {
      const { badges } = req.body;
      // Here you would typically save to database
      // For now, just return success
      res.json({ success: true, message: 'Badges updated successfully' });
   } catch (error) {
      res.status(500).json({ error: error.message });
   }
});

// POST /api/admin/badges/test - Test badge conditions
router.post('/api/admin/badges/test', (req, res) => {
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

