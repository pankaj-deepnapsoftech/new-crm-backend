const express = require('express');
const { sendBulkSms, getBulkSms } = require('../../controllers/sms/controller.js');
const router = express.Router();

router.post('/send-bulk-sms', sendBulkSms);
router.get('/get-bulk-sms', getBulkSms)

module.exports = router;