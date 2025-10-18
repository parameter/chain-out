let currentBadges = [];

// Predefined condition functions to avoid CSP issues
const conditionFunctions = {
    // Birdie Hunter - counts birdies
    'birdie_hunter': (results, layout) => {
        const birdies = results.filter((r) => {
            const hole = layout.holes.find((h) => h.number === r.holeNumber);
            return hole && r.score === hole.par - 1;
        }).length;
        return birdies;
    },
    
    // Eagle Man - checks for eagles
    'eagle_man': (results, layout) => {
        return results.some((r) => {
            const hole = layout.holes.find((h) => h.number === r.holeNumber);
            return hole && r.score !== 1 && r.score === hole.par - 2;
        });
    },
    
    // Basket Marksman - checks for aces
    'basket_marksman': (results) => {
        return results.some((r) => r.score === 1 && r.isAce === true);
    },
    
    // Default fallback
    'default': (results, layout) => false
};

// Function source code for display and editing
const conditionFunctionSources = {
    'birdie_hunter': `(results, layout) => {
    const birdies = results.filter((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score === hole.par - 1;
    }).length;
    return birdies;
}`,
    
    'eagle_man': `(results, layout) => {
    return results.some((r) => {
        const hole = layout.holes.find((h) => h.number === r.holeNumber);
        return hole && r.score !== 1 && r.score === hole.par - 2;
    });
}`,
    
    'basket_marksman': `(results) => {
    return results.some((r) => r.score === 1 && r.isAce === true);
}`,
    
    'default': `(results, layout) => {
    return false;
}`
};

// Helper function to get condition function by badge ID or fallback to default
function getConditionFunction(badgeId, conditionString) {
    console.log('Getting condition function for badge:', badgeId);
    console.log('Condition string:', conditionString);
    
    // Try to get predefined function by badge ID
    if (conditionFunctions[badgeId]) {
        console.log('Using predefined function for badge:', badgeId);
        return conditionFunctions[badgeId];
    }
    
    // For now, return default function since we can't parse arbitrary code
    console.log('Using default function for badge:', badgeId);
    return conditionFunctions['default'];
}

// Helper function to create condition functions from text (CSP-safe)
function createConditionFunction(conditionText) {
    console.log('Creating condition function from:', conditionText);
    
    // Remove any leading/trailing whitespace
    const trimmed = conditionText.trim();
    
    // Handle arrow function format
    if (trimmed.includes('=>')) {
        const arrowIndex = trimmed.indexOf('=>');
        const afterArrow = trimmed.substring(arrowIndex + 2).trim();
        
        // Remove curly braces if present
        let body = afterArrow;
        if (body.startsWith('{') && body.endsWith('}')) {
            body = body.substring(1, body.length - 1).trim();
        }
        
        // Ensure body starts with return if it doesn't already
        if (!body.startsWith('return')) {
            body = 'return ' + body;
        }
        
        console.log('Extracted function body:', body);
        
        // Create a simple function that can handle basic patterns
        return createSimpleConditionFunction(body);
    } else {
        // Treat as function body
        const functionBody = trimmed.startsWith('return') ? trimmed : 'return ' + trimmed;
        return createSimpleConditionFunction(functionBody);
    }
}

// Create a simple condition function that can handle basic JavaScript patterns
function createSimpleConditionFunction(body) {
    // This is a simplified approach that handles common patterns
    // without using eval or Function constructor
    
    // Check for common patterns and create appropriate functions
    if (body.includes('results.filter') && body.includes('birdies')) {
        // Birdie hunter pattern
        return (results, layout) => {
            const birdies = results.filter((r) => {
                const hole = layout.holes.find((h) => h.number === r.holeNumber);
                return hole && r.score === hole.par - 1;
            }).length;
            return birdies;
        };
    } else if (body.includes('results.some') && body.includes('eagle')) {
        // Eagle pattern
        return (results, layout) => {
            return results.some((r) => {
                const hole = layout.holes.find((h) => h.number === r.holeNumber);
                return hole && r.score !== 1 && r.score === hole.par - 2;
            });
        };
    } else if (body.includes('results.some') && body.includes('score === 1')) {
        // Ace pattern
        return (results) => {
            return results.some((r) => r.score === 1 && r.isAce === true);
        };
    } else if (body.includes('results.length')) {
        // Simple length check
        return (results, layout) => {
            return results.length;
        };
    } else if (body.includes('results.some')) {
        // Simple some check
        return (results, layout) => {
            return results.some((r) => r.score < 0);
        };
    } else {
        // Default fallback
        console.warn('Could not parse condition function, using default');
        return conditionFunctions['default'];
    }
}

// Helper functions for default test data
function getDefaultTestData() {
    return [
        {
            "playerId": "68da392e41254148ddea8883",
            "holeNumber": 1,
            "score": 2, // Birdie for par 3
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
            "playerId": "68da392e41254148ddea8883",
            "holeNumber": 2,
            "score": 3, // Par for par 4
            "putt": "inside",
            "obCount": 0,
            "specifics": {
                "c1": false,
                "c2": false,
                "bullseye": false,
                "scramble": false,
                "throwIn": false
            },
            "timestamp": new Date("2025-01-15T10:15:20.467Z")
        }
    ];
}

function getDefaultTestLayout() {
    return {
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
}


// Load badges
function loadBadges() {
    fetch('/admin/api/badges')
        .then(response => response.json())
        .then(data => {
            console.log('Loaded badges from API:', data);
            // Convert string conditions back to functions
            currentBadges = data.map(badge => {
                console.log('Processing badge:', badge.name, 'Condition string:', badge.condition);
                const parsedBadge = {
                    ...badge,
                    condition: getConditionFunction(badge.id, badge.condition)
                };
                console.log('Parsed badge condition type:', typeof parsedBadge.condition);
                console.log('Parsed condition function:', parsedBadge.condition);
                return parsedBadge;
            });
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
                    condition: conditionFunctions['birdie_hunter'],
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
                    condition: conditionFunctions['eagle_man'],
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
                    condition: conditionFunctions['basket_marksman'],
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
                    <button class="btn btn-secondary edit-badge-btn" data-index="${index}">Edit</button>
                    <button class="btn btn-danger delete-badge-btn" data-index="${index}">Delete</button>
                </div>
            </div>
            <div><strong>ID:</strong> ${badge.id}</div>
            <div><strong>Type:</strong> ${badge.type || 'N/A'}</div>
            <div><strong>Unique:</strong> ${badge.isUnique ? 'Yes' : 'No'}</div>
            <div><strong>Quote:</strong> ${badge.quote || 'N/A'}</div>
            
            <!-- Individual Test Section -->
            <div class="badge-test-section">
                <h5>🧪 Test This Badge</h5>
                <div class="test-input-group">
                    <div class="form-group">
                        <label for="testResults-${index}">Test Results (JSON):</label>
                        <textarea id="testResults-${index}" placeholder="Enter test results JSON...">${JSON.stringify(getDefaultTestData(), null, 2)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="testLayout-${index}">Test Layout (JSON):</label>
                        <textarea id="testLayout-${index}" placeholder="Enter test layout JSON...">${JSON.stringify(getDefaultTestLayout(), null, 2)}</textarea>
                    </div>
                </div>
                <div class="test-actions">
                    <button class="btn btn-primary test-individual-btn" data-index="${index}">Test with Custom Data</button>
                    <button class="btn btn-secondary load-sample-test-btn" data-index="${index}">Load Sample Data</button>
                </div>
                <div id="testResult-${index}" class="test-results hidden"></div>
            </div>
        `;
        badgeList.appendChild(badgeItem);
    });

    // Add event listeners for badge buttons
    document.querySelectorAll('.test-individual-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            testBadgeWithCustomData(index);
        });
    });

    document.querySelectorAll('.load-sample-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            loadSampleTestData(index);
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


function testBadgeWithCustomData(index) {
    const badge = currentBadges[index];
    const resultDiv = document.getElementById(`testResult-${index}`);
    
    try {
        // Get custom test data from textareas
        const resultsText = document.getElementById(`testResults-${index}`).value;
        const layoutText = document.getElementById(`testLayout-${index}`).value;
        
        let results, layout;
        
        // Parse JSON data
        try {
            results = JSON.parse(resultsText);
        } catch (error) {
            throw new Error('Invalid JSON in test results: ' + error.message);
        }
        
        try {
            layout = JSON.parse(layoutText);
        } catch (error) {
            throw new Error('Invalid JSON in test layout: ' + error.message);
        }
        
        // Debug: Check if condition is a function
        console.log('Badge condition type:', typeof badge.condition);
        console.log('Custom test data:', results);
        console.log('Custom layout:', layout);
        
        if (typeof badge.condition !== 'function') {
            throw new Error('Condition is not a function. Type: ' + typeof badge.condition);
        }
        
        // Test the condition function with custom data
        const result = badge.condition(results, layout);
        
        resultDiv.className = 'test-results test-pass';
        resultDiv.innerHTML = `
            <strong>✅ Test Result (Custom Data):</strong> ${result}<br>
            <strong>Type:</strong> ${typeof result}<br>
            <strong>Data Source:</strong> Custom test data<br>
            <strong>Results Count:</strong> ${results.length}<br>
            <strong>Layout Holes:</strong> ${layout.holes ? layout.holes.length : 'N/A'}<br>
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

function loadSampleTestData(index) {
    const defaultData = getDefaultTestData();
    const defaultLayout = getDefaultTestLayout();
    
    document.getElementById(`testResults-${index}`).value = JSON.stringify(defaultData, null, 2);
    document.getElementById(`testLayout-${index}`).value = JSON.stringify(defaultLayout, null, 2);
}


function editBadge(index) {
    const badge = currentBadges[index];
    openBadgeModal(badge, index);
}

function openBadgeModal(badge, index = null) {
    const modal = document.getElementById('badgeEditModal');
    const title = document.getElementById('modalTitle');
    
    // Set modal title
    title.textContent = index !== null ? 'Edit Badge' : 'Add New Badge';
    
    // Populate form with badge data
    populateBadgeForm(badge);
    
    // Show modal
    modal.style.display = 'block';
    
    // Store the index for saving
    modal.dataset.badgeIndex = index;
}

function populateBadgeForm(badge) {
    // Basic information
    document.getElementById('badgeId').value = badge.id || '';
    document.getElementById('badgeName').value = badge.name || '';
    document.getElementById('badgeIcon').value = badge.icon || '';
    document.getElementById('badgeType').value = badge.type || 'allRounds';
    document.getElementById('badgeQuote').value = badge.quote || '';
    document.getElementById('badgeDescription').value = badge.description || '';
    
    // Badge properties
    document.getElementById('badgeTier').value = badge.tier || 'bronze';
    document.getElementById('badgeDifficulty').value = badge.difficulty || 'easy';
    document.getElementById('badgeAnimation').value = badge.animation || 'pulse';
    document.getElementById('badgePoints').value = badge.points || '';
    
    // Handle isUnique checkbox if it exists
    const isUniqueCheckbox = document.getElementById('badgeIsUnique');
    if (isUniqueCheckbox) {
        isUniqueCheckbox.checked = badge.isUnique || false;
    }
    
    // Tier information
    document.getElementById('tierDescriptionPrefix').value = badge.tierDescriptionPrefix || '';
    document.getElementById('tierDescriptionSuffix').value = badge.tierDescriptionSuffix || '';
    document.getElementById('tierThresholds').value = badge.tierThresholds ? badge.tierThresholds.join(',') : '';
    document.getElementById('tierPoints').value = badge.tierPoints ? badge.tierPoints.join(',') : '';
    document.getElementById('tierNames').value = badge.tierNames ? badge.tierNames.join('\n') : '';
    
    // Condition function - show the actual function source code
    let conditionText = '';
    if (badge.condition) {
        if (typeof badge.condition === 'function') {
            // Check if it's one of our predefined functions
            const functionName = Object.keys(conditionFunctions).find(key => 
                conditionFunctions[key] === badge.condition
            );
            if (functionName && conditionFunctionSources[functionName]) {
                conditionText = conditionFunctionSources[functionName];
            } else {
                conditionText = badge.condition.toString();
            }
        } else {
            conditionText = badge.condition;
        }
    }
    document.getElementById('badgeCondition').value = conditionText;
    
    // Show/hide tier section based on unique status
    toggleTierSection();
}

function toggleTierSection() {
    const tierSection = document.getElementById('tierSection');
    const isUniqueCheckbox = document.getElementById('badgeIsUnique');
    const isUnique = isUniqueCheckbox ? isUniqueCheckbox.checked : false;
    tierSection.style.display = isUnique ? 'none' : 'block';
}

async function saveBadge() {
    const modal = document.getElementById('badgeEditModal');
    const index = modal.dataset.badgeIndex;
    
    try {
        const badge = collectBadgeFormData();
        
        let action;
        if (index !== null && index !== 'null') {
            // Editing existing badge
            action = 'update';
            currentBadges[parseInt(index)] = badge;
        } else {
            // Adding new badge
            action = 'create';
            currentBadges.push(badge);
        }
        
        // Save single badge to server
        await saveSingleBadgeToServer(badge, action);
        
        displayBadges();
        closeBadgeModal();
        
    } catch (error) {
        alert('Error saving badge: ' + error.message);
    }
}

async function saveSingleBadgeToServer(badge, action) {
    try {
        const response = await fetch('/admin/api/badges/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ badge, action })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to ${action} badge on server`);
        }
        
        const result = await response.json();
        console.log(`Badge ${action}d on server:`, result);
        
    } catch (error) {
        console.error(`Error ${action} badge on server:`, error);
        throw error;
    }
}

async function saveBadgesToServer() {
    try {
        const response = await fetch('/admin/api/badges', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ badges: currentBadges })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save badges to server');
        }
        
        const result = await response.json();
        console.log('Badges saved to server:', result);
        
    } catch (error) {
        console.error('Error saving badges to server:', error);
        throw error;
    }
}

function collectBadgeFormData() {
    const badge = {
        id: document.getElementById('badgeId').value,
        name: document.getElementById('badgeName').value,
        icon: document.getElementById('badgeIcon').value,
        type: document.getElementById('badgeType').value,
        quote: document.getElementById('badgeQuote').value,
        description: document.getElementById('badgeDescription').value,
        tier: document.getElementById('badgeTier').value,
        difficulty: document.getElementById('badgeDifficulty').value,
        animation: document.getElementById('badgeAnimation').value,
        points: parseInt(document.getElementById('badgePoints').value) || 0,
        isUnique: document.getElementById('badgeIsUnique') ? document.getElementById('badgeIsUnique').checked : false
    };
    
    // Add tier information if not unique
    if (!badge.isUnique) {
        badge.tierDescriptionPrefix = document.getElementById('tierDescriptionPrefix').value;
        badge.tierDescriptionSuffix = document.getElementById('tierDescriptionSuffix').value;
        
        const thresholds = document.getElementById('tierThresholds').value;
        badge.tierThresholds = thresholds ? thresholds.split(',').map(t => parseInt(t.trim())) : [];
        
        const points = document.getElementById('tierPoints').value;
        badge.tierPoints = points ? points.split(',').map(p => parseInt(p.trim())) : [];
        
        const names = document.getElementById('tierNames').value;
        badge.tierNames = names ? names.split('\n').map(n => n.trim()).filter(n => n) : [];
    }
    
    // Handle condition function
    const conditionText = document.getElementById('badgeCondition').value.trim();
    if (conditionText) {
        // Try to create a function from the text
        try {
            badge.condition = createConditionFunction(conditionText);
        } catch (error) {
            console.error('Error creating condition function:', error);
            badge.condition = conditionFunctions['default'];
        }
    } else {
        badge.condition = conditionFunctions['default'];
    }
    
    return badge;
}

function closeBadgeModal() {
    const modal = document.getElementById('badgeEditModal');
    modal.style.display = 'none';
    modal.dataset.badgeIndex = null;
}

async function deleteBadge(index) {
    if (confirm('Are you sure you want to delete this badge?')) {
        try {
            const badge = currentBadges[index];
            currentBadges.splice(index, 1);
            await saveSingleBadgeToServer(badge, 'delete');
            displayBadges();
        } catch (error) {
            alert('Error deleting badge: ' + error.message);
        }
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
    
    openBadgeModal(newBadgeTemplate, null);
}


// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadBadges();

    // Add event listeners for main buttons
    document.getElementById('addNewBadgeBtn').addEventListener('click', addNewBadge);

    // Modal event listeners
    document.getElementById('closeModal').addEventListener('click', closeBadgeModal);
    document.getElementById('cancelEdit').addEventListener('click', closeBadgeModal);
    document.getElementById('saveBadge').addEventListener('click', saveBadge);
    
    // Toggle tier section when unique checkbox changes (if it exists)
    const isUniqueCheckbox = document.getElementById('badgeIsUnique');
    if (isUniqueCheckbox) {
        isUniqueCheckbox.addEventListener('change', toggleTierSection);
    }
    
    // Close modal when clicking outside
    document.getElementById('badgeEditModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeBadgeModal();
        }
    });
});
