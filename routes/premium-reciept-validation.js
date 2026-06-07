const express = require('express');
const router = express.Router();
const passport = require('passport');

const appleReceiptVerify = require('apple-receipt-verify');
const google = require('googleapis');

const requireAuth = passport.authenticate('jwt', { session: false });


// 1. INITIALIZE APPLE VERIFIER
appleReceiptVerify.config({
    secret: process.env.APPLE_SHARED_SECRET, // App Store Connect Shared Secret
    environment: ['sandbox', 'production']  // Automatically checks sandbox during testing
});
  
// 2. INITIALIZE GOOGLE AUTHENTICATION
const auth = new google.auth.GoogleAuth({
    keyFile: './google-service-account.json', // Path to Google Cloud JSON key downloaded from Play Console
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const androidPublisher = google.androidpublisher({ version: 'v3', auth });
  


// 3. THE MAIN VERIFICATION ROUTE
router.post('/verify-purchase', requireAuth, async (req, res) => {
    const { receipt, platform, userId, productId, purchaseToken } = req.body;
  
    if (!platform || !userId) {
      return res.status(400).json({ isValid: false, message: 'Missing parameters' });
    }
  
    try {
      let isTransactionValid = false;
      let expiresAt = null;
  
      // --- CASE A: HANDLES APPLE iOS RECEIPTS ---
      if (platform === 'ios') {
        // Send raw receipt string directly to Apple's endpoints
        const products = await appleReceiptVerify.validate({ receipt });
        
        // Match the verified receipt item to what the user intended to buy
        const matchedPurchase = products.find(p => p.productId === productId);
  
        if (matchedPurchase) {
          isTransactionValid = true;
          // Apple provides a millisecond timestamp of expiration
          expiresAt = new Date(matchedPurchase.expirationDate); 
        }
      } 
      
      // --- CASE B: HANDLES GOOGLE ANDROID RECEIPTS ---
      else if (platform === 'android') {
        // Android relies on the explicit purchase token sent from the client app
        const result = await androidPublisher.purchases.subscriptions.get({
          packageName: process.env.ANDROID_PACKAGE_NAME, // e.g. com.yourdomain.app
          subscriptionId: productId,                     // e.g. com.yourapp.premium_monthly
          token: purchaseToken,                          // Unique code generated on device purchase
        });
  
        // Google acknowledgement states: 0 = Yet to be acknowledged, 1 = Acknowledged
        // Payment states: 1 = Payment received, 0 = Pending/Failed
        if (result.data.paymentState === 1) {
          isTransactionValid = true;
          expiresAt = new Date(parseInt(result.data.expiryTimeMillis));
        }
      }
  
      // --- STEP 4: UPDATE DATABASE AND GRANT PREMIUM ---
      if (isTransactionValid && expiresAt > new Date()) {
        
        // Pseudocode for database interaction:
        // await User.findByIdAndUpdate(userId, {
        //    isPremium: true,
        //    premiumExpiration: expiresAt
        // });
  
        return res.status(200).json({ 
          isValid: true, 
          message: 'Premium access successfully granted.',
          expiresAt 
        });
      } else {
        return res.status(400).json({ 
          isValid: false, 
          message: 'Invalid purchase or subscription has expired.' 
        });
      }
  
    } catch (error) {
      console.error('Upstream Verification Failure:', error);
      return res.status(500).json({ isValid: false, message: 'Internal validation server error.' });
    }
});
  
export default router;