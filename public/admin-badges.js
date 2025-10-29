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

// Helper function to get condition function by badge ID or from condition string
function getConditionFunction(badgeId, conditionString) {
    console.log('Getting condition function for badge:', badgeId);
    console.log('Condition string:', conditionString);
    
    // If we have a condition string from the database/JSON, use it
    if (conditionString && typeof conditionString === 'string') {
        console.log('Using condition string from database/JSON for badge:', badgeId);
        return createConditionFunctionFromString(conditionString);
    }
    
    // Try to get predefined function by badge ID as fallback
    if (conditionFunctions[badgeId]) {
        console.log('Using predefined function for badge:', badgeId);
        return conditionFunctions[badgeId];
    }
    
    // Default fallback
    console.log('Using default function for badge:', badgeId);
    return conditionFunctions['default'];
}

// Helper function to create condition functions from JSON string (CSP-safe)
function createConditionFunctionFromString(conditionString) {
    console.log('Creating condition function from JSON string:', conditionString);
    
    try {
        // The condition string from JSON is a function string like "function (results, layout) { ... }"
        // We need to safely convert this to an executable function without using eval or Function constructor
        
        const trimmed = conditionString.trim();
        
        // Extract the function body from the string
        const functionStart = trimmed.indexOf('{');
        const functionEnd = trimmed.lastIndexOf('}');
        
        if (functionStart !== -1 && functionEnd !== -1) {
            const functionBody = trimmed.substring(functionStart + 1, functionEnd).trim();
            console.log('Extracted function body:', functionBody);
            
            // Use pattern matching to create appropriate functions without eval
            return createConditionFunctionFromBody(functionBody);
        } else {
            console.warn('Could not parse function from string, using default');
            return conditionFunctions['default'];
        }
    } catch (error) {
        console.error('Error creating function from string:', error);
        return conditionFunctions['default'];
    }
}

// Helper function to create condition functions from function body without eval
function createConditionFunctionFromBody(functionBody) {
    console.log('Creating condition function from body:', functionBody);
    
    // Use pattern matching to identify common condition patterns from badges.json
    
    // Birdie Hunter - count birdies
    if (functionBody.includes('results.filter') && functionBody.includes('hole.par - 1')) {
        return (results, layout) => {
            const birdies = results.filter((r) => {
                const hole = layout.holes.find((h) => h.number === r.holeNumber);
                return hole && r.score === hole.par - 1;
            }).length;
            return birdies;
        };
    }
    
    // Bird Collector - distinct courses with birdies
    if (functionBody.includes('distinctCourses') && functionBody.includes('courseId')) {
        return (results, layout) => {
            const distinctCourses = new Set(results.map((r) => r.courseId));
            return distinctCourses.size;
        };
    }
    
    // Bullseye Hunter - hit bullseye
    if (functionBody.includes('hitBullseye')) {
        return (results) => {
            return results.some((r) => r.hitBullseye === true);
        };
    }
    
    // Course Collector - unique courses
    if (functionBody.includes('uniqueCourses') && functionBody.includes('courseId')) {
        return (results) => {
            const uniqueCourses = new Set(results.map((r) => r.courseId));
            return uniqueCourses.size;
        };
    }
    
    // Eagle Man - score eagle
    if (functionBody.includes('hole.par - 2') && functionBody.includes('score !== 1')) {
        return (results, layout) => {
            return results.some((r) => {
                const hole = layout.holes.find((h) => h.number === r.holeNumber);
                return hole && r.score !== 1 && r.score === hole.par - 2;
            });
        };
    }
    
    // Round Rollercoaster - alternating scores
    if (functionBody.includes('streak') && functionBody.includes('prev < 0')) {
        return (results) => {
            let streak = 0;
            for (let i = 1; i < results.length; i++) {
                const prev = results[i - 1].score;
                const curr = results[i].score;
                if ((prev < 0 && curr > 0) || (prev > 0 && curr < 0)) {
                    streak++;
                }
            }
            return streak >= 2;
        };
    }
    
    // Three Wishes - secret achievements
    if (functionBody.includes('isSecretAchieved')) {
        return (results, layout) => {
            return results.filter((r) => r.isSecretAchieved).length >= 3;
        };
    }
    
    // Basket Marksman - aces
    if (functionBody.includes('score === 1') && functionBody.includes('isAce')) {
        return (results) => {
            return results.some((r) => r.score === 1 && r.isAce === true);
        };
    }
    
    // Comeback - double bogey followed by two birdies
    if (functionBody.includes('dblBogey') && functionBody.includes('birdie1') && functionBody.includes('birdie2')) {
        return (results, layout) => {
            for (let i = 2; i < results.length; i++) {
                const hole1 = layout.holes.find((h) => h.number === results[i - 2].holeNumber);
                const hole2 = layout.holes.find((h) => h.number === results[i - 1].holeNumber);
                const hole3 = layout.holes.find((h) => h.number === results[i].holeNumber);
                const dblBogey = hole1 && results[i - 2].score === hole1.par + 2;
                const birdie1 = hole2 && results[i - 1].score === hole2.par - 1;
                const birdie2 = hole3 && results[i].score === hole3.par - 1;
                if (dblBogey && birdie1 && birdie2) return true;
            }
            return false;
        };
    }
    
    // OB Hunter - OB hits
    if (functionBody.includes('obCount')) {
        return (results) => {
            const obHits = results.filter((r) => r.obCount).length;
            return obHits;
        };
    }
    
    // Default fallback
    console.warn('Could not parse condition function body, using default');
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
async function loadBadges() {
    fetch('/admin/api/badges')
        .then(response => response.json())
        .then(async data => {
            console.log('Loaded badges from API:', data);
            // Convert string conditions back to functions, but preserve original string
            currentBadges = data.map(badge => {
                console.log('Processing badge:', badge.name, 'Condition string:', badge.condition);
                const parsedBadge = {
                    ...badge,
                    condition: getConditionFunction(badge.id, badge.condition),
                    conditionString: badge.condition // Preserve original string for editing
                };
                console.log('Parsed badge condition type:', typeof parsedBadge.condition);
                console.log('Parsed condition function:', parsedBadge.condition);
                return parsedBadge;
            });
            await displayBadges();
        })
        .catch(error => {
            console.error('Error loading badges:', error);
            // Load sample badges if API fails
            
        });
}

async function displayBadges() {
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
            <div><strong>Track Unique Courses:</strong> ${badge.trackUniqueCourses ? 'Yes' : 'No'}</div>
            <div><strong>Quote:</strong> ${badge.quote || 'N/A'}</div>
            <div><strong>Test Data Count:</strong> <span id="testDataCount-${index}">Loading...</span></div>
            
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
                    <button class="btn btn-success save-test-data-btn" data-index="${index}">Save Test Data to Badge</button>
                    <button class="btn btn-warning clear-test-data-btn" data-index="${index}" style="display: none;">Clear All Test Data</button>
                </div>
                <div id="testResult-${index}" class="test-results hidden"></div>
                
                <!-- Show existing test data if available -->
                <div class="existing-test-data" id="existingTestData-${index}" style="display: none;">
                    <h6>📊 Saved Test Data (<span id="testDataCountDisplay-${index}">0</span> entries)</h6>
                    <div class="test-data-list" id="testDataList-${index}">
                        <!-- Test data will be loaded here -->
                    </div>
                </div>
            </div>
        `;
        badgeList.appendChild(badgeItem);
    });

    // Load test data for each badge
    await loadTestDataForAllBadges();

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

    document.querySelectorAll('.save-test-data-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            saveTestDataToBadge(index);
        });
    });

    document.querySelectorAll('.load-saved-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const badgeIndex = parseInt(e.target.getAttribute('data-badge-index'));
            const testIndex = parseInt(e.target.getAttribute('data-test-index'));
            loadSavedTestData(badgeIndex, testIndex);
        });
    });

    document.querySelectorAll('.clear-test-data-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            clearTestData(index);
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


async function testBadgeWithCustomData(index) {
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
        
        // Debug: Log test data
        console.log('Testing badge via API:', badge.name);
        console.log('Custom test data:', results);
        console.log('Custom layout:', layout);
        
        // Use the API route to test the badge
        const response = await fetch('/admin/api/badges/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                badge: badge,
                testData: results,
                layout: layout
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const apiResult = await response.json();
        
        if (apiResult.success) {
            resultDiv.className = 'test-results test-pass';
            resultDiv.innerHTML = `
                <strong>✅ Test Result (API):</strong> ${apiResult.result}<br>
                <strong>Type:</strong> ${apiResult.resultType}<br>
                <strong>Data Source:</strong> API test data<br>
                <strong>Results Count:</strong> ${apiResult.testDataCount}<br>
                <strong>Layout Holes:</strong> ${apiResult.layoutHolesCount}<br>
                <strong>Timestamp:</strong> ${new Date().toLocaleString()}
            `;
        } else {
            throw new Error(apiResult.error || 'Unknown API error');
        }
        
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

async function loadTestDataForAllBadges() {
    for (let i = 0; i < currentBadges.length; i++) {
        await loadTestDataForBadge(i);
    }
}

async function loadTestDataForBadge(badgeIndex) {
    const badge = currentBadges[badgeIndex];
    
    try {
        // Fetch test data for this badge
        const response = await fetch(`/admin/api/badges/test-data/${badge._id}`);
        
        if (response.ok) {
            const testDataArray = await response.json();
            
            // Update test data count
            const countElement = document.getElementById(`testDataCount-${badgeIndex}`);
            if (countElement) {
                countElement.textContent = testDataArray.length;
            }
            
            // Update test data count display
            const countDisplayElement = document.getElementById(`testDataCountDisplay-${badgeIndex}`);
            if (countDisplayElement) {
                countDisplayElement.textContent = testDataArray.length;
            }
            
            // Show/hide existing test data section
            const existingTestDataElement = document.getElementById(`existingTestData-${badgeIndex}`);
            if (existingTestDataElement) {
                if (testDataArray.length > 0) {
                    existingTestDataElement.style.display = 'block';
                    
                    // Update test data list
                    const testDataListElement = document.getElementById(`testDataList-${badgeIndex}`);
                    if (testDataListElement) {
                        testDataListElement.innerHTML = testDataArray.map((testData, testIndex) => `
                            <div class="test-data-item">
                                <strong>Test ${testIndex + 1}:</strong> ${testData.results.length} results, ${testData.layout.holes ? testData.layout.holes.length : 0} holes
                                <br><small>Saved: ${new Date(testData.savedAt).toLocaleString()}</small>
                                <button class="btn btn-sm btn-secondary load-saved-test-btn" data-badge-index="${badgeIndex}" data-test-index="${testIndex}">Load This Test</button>
                            </div>
                        `).join('');
                    }
                    
                    // Show clear button if there's test data
                    const clearButton = document.querySelector(`[data-index="${badgeIndex}"].clear-test-data-btn`);
                    if (clearButton) {
                        clearButton.style.display = 'inline-block';
                    }
                    
                    // Auto-load the most recent test data into the textareas
                    const mostRecentTestData = testDataArray[testDataArray.length - 1]; // Get the last (most recent) test data
                    if (mostRecentTestData) {
                        document.getElementById(`testResults-${badgeIndex}`).value = JSON.stringify(mostRecentTestData.results, null, 2);
                        document.getElementById(`testLayout-${badgeIndex}`).value = JSON.stringify(mostRecentTestData.layout, null, 2);
                        
                        // Show a notification that test data was auto-loaded
                        const resultDiv = document.getElementById(`testResult-${badgeIndex}`);
                        resultDiv.className = 'test-results test-pass';
                        resultDiv.innerHTML = `
                            <strong>🔄 Auto-loaded Saved Test Data</strong><br>
                            <strong>Test Data:</strong> ${mostRecentTestData.results.length} results, ${mostRecentTestData.layout.holes ? mostRecentTestData.layout.holes.length : 0} holes<br>
                            <strong>Originally Saved:</strong> ${new Date(mostRecentTestData.savedAt).toLocaleString()}<br>
                            <strong>Auto-loaded At:</strong> ${new Date().toLocaleString()}
                        `;
                        resultDiv.classList.remove('hidden');
                    }
                } else {
                    existingTestDataElement.style.display = 'none';
                    
                    // Hide clear button if no test data
                    const clearButton = document.querySelector(`[data-index="${badgeIndex}"].clear-test-data-btn`);
                    if (clearButton) {
                        clearButton.style.display = 'none';
                    }
                }
            }
        } else {
            // If no test data or error, set count to 0 and load default test data
            const countElement = document.getElementById(`testDataCount-${badgeIndex}`);
            if (countElement) {
                countElement.textContent = '0';
            }
            
            // Load default test data when no saved test data exists
            const defaultData = getDefaultTestData();
            const defaultLayout = getDefaultTestLayout();
            document.getElementById(`testResults-${badgeIndex}`).value = JSON.stringify(defaultData, null, 2);
            document.getElementById(`testLayout-${badgeIndex}`).value = JSON.stringify(defaultLayout, null, 2);
        }
    } catch (error) {
        console.error(`Error loading test data for badge ${badge.name}:`, error);
        const countElement = document.getElementById(`testDataCount-${badgeIndex}`);
        if (countElement) {
            countElement.textContent = 'Error';
        }
        
        // Load default test data when there's an error
        const defaultData = getDefaultTestData();
        const defaultLayout = getDefaultTestLayout();
        document.getElementById(`testResults-${badgeIndex}`).value = JSON.stringify(defaultData, null, 2);
        document.getElementById(`testLayout-${badgeIndex}`).value = JSON.stringify(defaultLayout, null, 2);
    }
}

function loadSampleTestData(index) {
    const defaultData = getDefaultTestData();
    const defaultLayout = getDefaultTestLayout();
    
    document.getElementById(`testResults-${index}`).value = JSON.stringify(defaultData, null, 2);
    document.getElementById(`testLayout-${index}`).value = JSON.stringify(defaultLayout, null, 2);
}

async function saveTestDataToBadge(index) {
    const badge = currentBadges[index];
    const resultDiv = document.getElementById(`testResult-${index}`);
    
    try {
        // Get test data from textareas
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
        
        // Create test data object
        const testData = {
            results: results,
            layout: layout,
            savedAt: new Date().toISOString(),
            savedBy: 'admin'
        };
        
        // Save test data using the new API endpoint
        const response = await fetch('/admin/api/badges/test-data/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                badgeId: badge._id, 
                testData: testData 
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save test data: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        resultDiv.className = 'test-results test-pass';
        resultDiv.innerHTML = `
            <strong>✅ Test Data Saved Successfully!</strong><br>
            <strong>Badge:</strong> ${badge.name}<br>
            <strong>Test Data ID:</strong> ${result.testDataId}<br>
            <strong>Results Count:</strong> ${results.length}<br>
            <strong>Layout Holes:</strong> ${layout.holes ? layout.holes.length : 'N/A'}<br>
            <strong>Saved At:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
        
        // Refresh the badge display to show updated test data count
        await loadBadges();
        
    } catch (error) {
        resultDiv.className = 'test-results test-fail';
        resultDiv.innerHTML = `
            <strong>❌ Failed to Save Test Data:</strong> ${error.message}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
    }
}

async function loadSavedTestData(badgeIndex, testIndex) {
    const badge = currentBadges[badgeIndex];
    const resultDiv = document.getElementById(`testResult-${badgeIndex}`);
    
    try {
        // Fetch test data for this badge from the API
        const response = await fetch(`/admin/api/badges/test-data/${badge._id}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load test data: ${response.statusText}`);
        }
        
        const testDataArray = await response.json();
        
        if (!testDataArray || testDataArray.length === 0 || !testDataArray[testIndex]) {
            alert('Test data not found');
            return;
        }
        
        const testData = testDataArray[testIndex];
        
        // Load the saved test data into the textareas
        document.getElementById(`testResults-${badgeIndex}`).value = JSON.stringify(testData.results, null, 2);
        document.getElementById(`testLayout-${badgeIndex}`).value = JSON.stringify(testData.layout, null, 2);
        
        // Show a success message
        resultDiv.className = 'test-results test-pass';
        resultDiv.innerHTML = `
            <strong>✅ Loaded Saved Test Data!</strong><br>
            <strong>Test Data:</strong> ${testData.results.length} results, ${testData.layout.holes ? testData.layout.holes.length : 0} holes<br>
            <strong>Originally Saved:</strong> ${new Date(testData.savedAt).toLocaleString()}<br>
            <strong>Loaded At:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
        
    } catch (error) {
        resultDiv.className = 'test-results test-fail';
        resultDiv.innerHTML = `
            <strong>❌ Failed to Load Test Data:</strong> ${error.message}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
    }
}

async function clearTestData(index) {
    if (!confirm('Are you sure you want to clear all test data for this badge?')) {
        return;
    }
    
    const badge = currentBadges[index];
    const resultDiv = document.getElementById(`testResult-${index}`);
    
    try {
        // Clear test data using the new API endpoint
        const response = await fetch(`/admin/api/badges/test-data/${badge._id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to clear test data: ${response.statusText}`);
        }
        
        resultDiv.className = 'test-results test-pass';
        resultDiv.innerHTML = `
            <strong>✅ Test Data Cleared Successfully!</strong><br>
            <strong>Badge:</strong> ${badge.name}<br>
            <strong>Cleared At:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
        
        // Refresh the badge display to update the UI
        await loadBadges();
        
    } catch (error) {
        resultDiv.className = 'test-results test-fail';
        resultDiv.innerHTML = `
            <strong>❌ Failed to Clear Test Data:</strong> ${error.message}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
        `;
        resultDiv.classList.remove('hidden');
    }
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
    
    // Set the new Type field (unique, tiered, secret)
    const badgeType = badge.type || 'unique';
    document.getElementById('badgeType').value = badgeType;
    
    document.getElementById('badgeQuote').value = badge.quote || '';
    document.getElementById('badgeDescription').value = badge.description || '';
    document.getElementById('badgeFunctionalDescription').value = badge.functionalDescription || '';
    
    // Store the _id for later use
    document.getElementById('badgeEditModal').dataset.badgeId = badge._id || '';
    
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
    
    // Handle trackUniqueCourses checkbox
    const trackUniqueCoursesCheckbox = document.getElementById('trackUniqueCourses');
    if (trackUniqueCoursesCheckbox) {
        trackUniqueCoursesCheckbox.checked = badge.trackUniqueCourses || false;
    }
    
    // Tier information
    document.getElementById('tierDescriptionPrefix').value = badge.tierDescriptionPrefix || '';
    document.getElementById('tierDescriptionSuffix').value = badge.tierDescriptionSuffix || '';
    document.getElementById('tierThresholds').value = badge.tierThresholds ? badge.tierThresholds.join(',') : '';
    document.getElementById('tierPoints').value = badge.tierPoints ? badge.tierPoints.join(',') : '';
    document.getElementById('tierNames').value = badge.tierNames ? badge.tierNames.join('\n') : '';
    
    // Condition function - show the actual function source code
    let conditionText = '';
    if (badge.conditionString) {
        // Use the preserved condition string from database/JSON
        conditionText = badge.conditionString;
    } else if (badge.condition) {
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
            // It's already a string (source code from database/JSON)
            conditionText = badge.condition;
        }
    }
    document.getElementById('badgeCondition').value = conditionText;
    
    // Show/hide tier section based on unique status
    toggleTierSection();
}

function toggleTierSection() {
    const badgeType = document.getElementById('badgeType').value;
    const uniqueBadgeSection = document.getElementById('uniqueBadgeSection');
    const tieredBadgeSection = document.getElementById('tieredBadgeSection');
    
    // Hide both sections first
    if (uniqueBadgeSection) uniqueBadgeSection.style.display = 'none';
    if (tieredBadgeSection) tieredBadgeSection.style.display = 'none';
    
    // Show appropriate section based on type
    if (badgeType === 'unique') {
        if (uniqueBadgeSection) uniqueBadgeSection.style.display = 'block';
    } else if (badgeType === 'tiered') {
        if (tieredBadgeSection) tieredBadgeSection.style.display = 'block';
    }
    // For 'secret' type, both sections remain hidden
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
        type: document.getElementById('badgeType').value, // Now contains unique/tiered/secret
        quote: document.getElementById('badgeQuote').value,
        description: document.getElementById('badgeDescription').value,
        functionalDescription: document.getElementById('badgeFunctionalDescription').value,
        tier: document.getElementById('badgeTier').value,
        difficulty: document.getElementById('badgeDifficulty').value,
        animation: document.getElementById('badgeAnimation').value,
        points: parseInt(document.getElementById('badgePoints').value) || 0,
        isUnique: document.getElementById('badgeIsUnique') ? document.getElementById('badgeIsUnique').checked : false,
        trackUniqueCourses: document.getElementById('trackUniqueCourses') ? document.getElementById('trackUniqueCourses').checked : false
    };

    // Preserve MongoDB _id for updates by retrieving it from the modal dataset
    const modalEl = document.getElementById('badgeEditModal');
    if (modalEl && modalEl.dataset && modalEl.dataset.badgeId) {
        badge._id = modalEl.dataset.badgeId;
    }

    
    // Always include tier configuration so switching type doesn't overwrite stored values
    badge.tierDescriptionPrefix = document.getElementById('tierDescriptionPrefix').value;
    badge.tierDescriptionSuffix = document.getElementById('tierDescriptionSuffix').value;
    
    const thresholds = document.getElementById('tierThresholds').value;
    badge.tierThresholds = thresholds ? thresholds.split(',').map(t => parseInt(t.trim())) : [];
    
    const points = document.getElementById('tierPoints').value;
    badge.tierPoints = points ? points.split(',').map(p => parseInt(p.trim())) : [];
    
    const names = document.getElementById('tierNames').value;
    badge.tierNames = names ? names.split('\n').map(n => n.trim()).filter(n => n) : [];
    
    // Handle condition function - store as string for JSON serialization
    const conditionText = document.getElementById('badgeCondition').value.trim();
    if (conditionText) {
        // Store the condition as a string (source code) for JSON serialization
        badge.condition = conditionText;
    } else {
        // Use default condition source code
        badge.condition = conditionFunctionSources['default'];
    }
    
    // Remove the conditionString field as it's only used for display
    delete badge.conditionString;
    
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
        isUnique: false,
        type: "unique", // New type field
        tier: "bronze",
        difficulty: "easy",
        animation: "pulse",
        condition: (results, layout) => {
            // Your condition logic here
            return 0;
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
    
    // Toggle tier section when Type field changes
    const badgeTypeSelect = document.getElementById('badgeType');
    if (badgeTypeSelect) {
        badgeTypeSelect.addEventListener('change', toggleTierSection);
    }
    
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
