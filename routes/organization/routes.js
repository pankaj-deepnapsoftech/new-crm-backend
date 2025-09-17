const express = require('express');
const { create, verifyOTP, login, loginWithAccessToken, getOTP, passwordResetOTPVerify, resetPassword,activateTrialAccount, isAuthenticatedOrganization } = require('../../controllers/organization/controller');
const { chatimage } = require('../../utils/multer');
const { createOrganizationValidator, validateHandler, verifyOTPValidator, loginValidator, getOTPValidator } = require('../../validators/organization/validator');
const { passwordResetTokenValidator, resetPasswordValidator} = require('../../validators/auth/validator');
const router = express.Router();

router.post('/create', createOrganizationValidator(), validateHandler, chatimage.single('profileImage'), create);
// router.post('/create', chatimage.single('profileImage'), create);
router.post('/verify', verifyOTPValidator(), validateHandler, verifyOTP);
router.post('/login', loginValidator(), validateHandler, login);
router.post('/get-otp', getOTPValidator(), validateHandler, getOTP);
router.get('/login-with-token', loginWithAccessToken);
router.post('/password-reset-token', passwordResetTokenValidator(), validateHandler, passwordResetOTPVerify);
router.post('/reset-password', resetPasswordValidator(), validateHandler, resetPassword);
router.get('/trial-account',isAuthenticatedOrganization, activateTrialAccount)

module.exports = router;