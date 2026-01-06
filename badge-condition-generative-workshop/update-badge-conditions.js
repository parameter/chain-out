const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { initializeDatabase, getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

async function updateBadgeConditions() {
    try {
        // Load generated conditions
        const generatedConditionsPath = path.join(__dirname, 'generated-conditions.json');
        const generatedConditions = JSON.parse(fs.readFileSync(generatedConditionsPath, 'utf8'));
        
        console.log(`Loaded ${generatedConditions.length} generated conditions\n`);
        
        // Filter out TODO conditions (those that need manual review)
        const validConditions = generatedConditions.filter(c => 
            c.condition && 
            !c.condition.includes('TODO') && 
            c.id && 
            c.id !== 'undefined'
        );
        
        console.log(`Valid conditions to update: ${validConditions.length}`);
        console.log(`Skipping ${generatedConditions.length - validConditions.length} conditions that need manual review\n`);
        
        // Initialize database connection
        console.log('Initializing database connection...');
        await initializeDatabase();
        const db = getDatabase();
        
        const badgeDefinitionsCollection = db.collection('badgeDefinitions');
        
        let updatedCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;
        
        // Update each badge
        for (const conditionData of validConditions) {
            try {
                // Find badge by id field (not _id)
                const result = await badgeDefinitionsCollection.updateOne(
                    { id: conditionData.id },
                    { 
                        $set: { 
                            condition: conditionData.condition
                        }
                    }
                );
                
                if (result.matchedCount === 0) {
                    console.warn(`  ⚠️  Badge not found: ${conditionData.name} (${conditionData.id})`);
                    notFoundCount++;
                } else if (result.modifiedCount > 0) {
                    console.log(`  ✅ Updated: ${conditionData.name} (${conditionData.id})`);
                    updatedCount++;
                } else {
                    console.log(`  ℹ️  No changes: ${conditionData.name} (${conditionData.id})`);
                }
            } catch (error) {
                console.error(`  ❌ Error updating ${conditionData.name} (${conditionData.id}):`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n=== Update Summary ===`);
        console.log(`  ✅ Successfully updated: ${updatedCount}`);
        console.log(`  ℹ️  No changes needed: ${validConditions.length - updatedCount - notFoundCount - errorCount}`);
        console.log(`  ⚠️  Not found: ${notFoundCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateBadgeConditions();

