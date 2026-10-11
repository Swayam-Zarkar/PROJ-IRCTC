const express=require('express');
const authcontroller=require('../controller/authcontroller');
const router=express.Router();
const authController = require('../controller/authcontroller');
const { verifyJWT } = require('../middleware/authMiddleware');



router.post('/auth/register', authController.registerUser);
router.post('/auth/verify-OTP', authController.verifyOTP);
router.post('/auth/verify-otp', authController.verifyOTP); // Lowercase alias for convenience
router.post('/auth/resend-otp', authController.resendOTP);
router.post('/auth/login', authController.loginUser);
router.post('/auth/logout', authController.logoutUser);

module.exports=router;
// Protected User Profile & IRCTC Master Passenger List Routes
router.get('/auth/me', verifyJWT, authController.getCurrentUser);
router.post('/auth/passengers', verifyJWT, authController.addSavedPassenger);
router.delete('/auth/passengers/:passengerId', verifyJWT, authController.removeSavedPassenger);

module.exports = router;