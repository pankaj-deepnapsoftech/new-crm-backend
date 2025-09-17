const express = require('express');
const { createLead, editLead, deleteLead, leadDetails, allLeads, assignedLeads, followupReminders, seenFollowupReminders, getUnseenNotfications, leadSummary, bulkUpload, deleteAllLead, bulkAssign, bulkDownload, dataBank } = require('../../controllers/Lead/controller');
const { createLeadValidator, validateHandler, editLeadValidator, deleteLeadValidator, leadDetailsValidator } = require('../../validators/lead/validator');
const { checkAccess } = require('../../helpers/checkAccess');
const { upload } = require('../../utils/multer');
const { isAuthenticated } = require('../../controllers/auth/controller');
const router = express.Router();

router.post('/create-lead', checkAccess, createLeadValidator(), validateHandler, createLead);
router.post('/edit-lead', checkAccess, editLeadValidator(), validateHandler, editLead);
router.post('/delete-lead', checkAccess, deleteLeadValidator(), validateHandler, deleteLead);
router.get('/delete-all', checkAccess, deleteAllLead);
router.post('/lead-details', checkAccess, leadDetailsValidator(), validateHandler, leadDetails);
router.post('/all-leads', allLeads);
router.get('/assigned-lead', checkAccess, assignedLeads);
router.get('/lead-summary', checkAccess, leadSummary);
router.post('/bulk-upload', upload.single('excel'), bulkUpload)
router.get('/bulk-download', checkAccess, bulkDownload)
router.post('/bulk-assign', checkAccess, bulkAssign)
router.post('/data/bank', checkAccess , dataBank)

module.exports = router;