const express = require('express');
const { createCompanyValidator, validateHandler, editCompanyValidator, deleteCompanyValidator, companyDetailsValidator } = require('../../validators/company/validator');
const { createCompany, editCompany, deleteCompany, companyDetails, allCompanies } = require('../../controllers/company/controller');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.post('/create-company', checkAccess, createCompanyValidator(), validateHandler, createCompany);
router.post('/edit-company', checkAccess, editCompanyValidator(), validateHandler, editCompany);
router.post('/delete-company', checkAccess, deleteCompanyValidator(), validateHandler, deleteCompany);
router.post('/company-details', checkAccess, companyDetailsValidator(), validateHandler, companyDetails);
router.post('/all-companies', allCompanies);

module.exports = router;