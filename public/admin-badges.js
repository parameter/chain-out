let currentBadges = [];
let currentTestData = [];
let currentLayout = {};

// Load sample data
function loadSampleData() {
    currentTestData = [
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
    document.getElementById('testResultsDisplay').textContent = JSON.stringify(currentTestData, null, 2);
}

function loadSampleLayout() {
    currentLayout = {
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
    document.getElementById('testLayoutDisplay').textContent = JSON.stringify(currentLayout, null, 2);
}

// Load badges
function loadBadges() {
    fetch('/admin/api/badges')
        .then(response => response.json())
        .then(data => {
            currentBadges = data;
            displayBadges();
        })
        .catch(error => {
            console.error('Error loading badges:', error);
            // Load sample badges if API fails
            currentBadges = [
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
            displayBadges();
        });
}

function displayBadges() {
    const badgeList = document.getElementById('badgeList');
    badgeList.innerHTML = '';

    currentBadges.forEach((badge, index) => {
        const badgeItem = document.createElement('div');
        badgeItem.className = 'badge-item';
        badgeItem.innerHTML = `
            <div class="badge-header">
                <div class="badge-name">${badge.name}</div>
                <div class="badge-actions">
                    <button class="btn btn-primary test-badge-btn" data-index="${index}">Test</button>
                    <button class="btn btn-secondary edit-badge-btn" data-index="${index}">Edit</button>
                    <button class="btn btn-danger delete-badge-btn" data-index="${index}">Delete</button>
                </div>
            </div>
            <div><strong>ID:</strong> ${badge.id}</div>
            <div><strong>Type:</strong> ${badge.type || 'N/A'}</div>
            <div><strong>Unique:</strong> ${badge.isUnique ? 'Yes' : 'No'}</div>
            <div><strong>Quote:</strong> ${badge.quote || 'N/A'}</div>
            <div id="testResult-${index}" class="test-results hidden"></div>
        `;
        badgeList.appendChild(badgeItem);
    });

    // Add event listeners for badge buttons
    document.querySelectorAll('.test-badge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            testBadge(index);
        });
    });

    document.querySelectorAll('.edit-badge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            editBadge(index);
        });
    });

    document.querySelectorAll('.delete-badge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            deleteBadge(index);
        });
    });
}

function testBadge(index) {
    const badge = currentBadges[index];
    const resultDiv = document.getElementById(`testResult-${index}`);
    
    try {
        // Create a safe evaluation environment
        const results = currentTestData;
        const layout = currentLayout;
        
        // Test the condition function
        const result = badge.condition(results, layout);
        
        resultDiv.className = 'test-results test-pass';
        resultDiv.innerHTML = `
            <strong>✅ Test Result:</strong> ${result}<br>
            <strong>Type:</strong> ${typeof result}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
        
    } catch (error) {
        resultDiv.className = 'test-results test-fail';
        resultDiv.innerHTML = `
            <strong>❌ Test Failed:</strong> ${error.message}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
    }
}

function testAllBadges() {
    const resultsDiv = document.getElementById('allTestResults');
    resultsDiv.innerHTML = '<h4>Testing all badges...</h4>';
    
    let passed = 0;
    let failed = 0;
    
    currentBadges.forEach((badge, index) => {
        try {
            const result = badge.condition(currentTestData, currentLayout);
            passed++;
            resultsDiv.innerHTML += `
                <div class="test-results test-pass">
                    <strong>${badge.name}:</strong> ✅ Passed (Result: ${result})
                </div>
            `;
        } catch (error) {
            failed++;
            resultsDiv.innerHTML += `
                <div class="test-results test-fail">
                    <strong>${badge.name}:</strong> ❌ Failed (${error.message})
                </div>
            `;
        }
    });
    
    resultsDiv.innerHTML += `
        <div style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 4px;">
            <strong>Summary:</strong> ${passed} passed, ${failed} failed
        </div>
    `;
}

function editBadge(index) {
    const badge = currentBadges[index];
    const newBadge = prompt('Edit badge (JSON format):', JSON.stringify(badge, null, 2));
    
    if (newBadge) {
        try {
            const parsedBadge = JSON.parse(newBadge);
            currentBadges[index] = parsedBadge;
            displayBadges();
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    }
}

function deleteBadge(index) {
    if (confirm('Are you sure you want to delete this badge?')) {
        currentBadges.splice(index, 1);
        displayBadges();
    }
}

function addNewBadge() {
    const newBadgeTemplate = {
        id: "new_badge",
        name: "New Badge",
        quote: "A new badge description",
        icon: "new-badge",
        isUnique: false,
        type: "allRounds",
        tier: "bronze",
        difficulty: "easy",
        animation: "pulse",
        condition: (results, layout) => {
            // Your condition logic here
            return results.length > 0;
        }
    };
    
    const newBadge = prompt('Add new badge (JSON format):', JSON.stringify(newBadgeTemplate, null, 2));
    
    if (newBadge) {
        try {
            const parsedBadge = JSON.parse(newBadge);
            currentBadges.push(parsedBadge);
            displayBadges();
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    }
}

function editTestData() {
    const newData = prompt('Edit test data (JSON format):', JSON.stringify(currentTestData, null, 2));
    if (newData) {
        try {
            currentTestData = JSON.parse(newData);
            document.getElementById('testResultsDisplay').textContent = JSON.stringify(currentTestData, null, 2);
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    }
}

function editTestLayout() {
    const newLayout = prompt('Edit test layout (JSON format):', JSON.stringify(currentLayout, null, 2));
    if (newLayout) {
        try {
            currentLayout = JSON.parse(newLayout);
            document.getElementById('testLayoutDisplay').textContent = JSON.stringify(currentLayout, null, 2);
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadSampleData();
    loadSampleLayout();
    loadBadges();

    // Add event listeners for main buttons
    document.getElementById('loadSampleDataBtn').addEventListener('click', loadSampleData);
    document.getElementById('editTestDataBtn').addEventListener('click', editTestData);
    document.getElementById('loadSampleLayoutBtn').addEventListener('click', loadSampleLayout);
    document.getElementById('editTestLayoutBtn').addEventListener('click', editTestLayout);
    document.getElementById('addNewBadgeBtn').addEventListener('click', addNewBadge);
    document.getElementById('testAllBadgesBtn').addEventListener('click', testAllBadges);
});
