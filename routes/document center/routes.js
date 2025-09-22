const express = require("express");
const { checkAccess } = require("../../helpers/checkAccess");
const {
  createDocument,
  getDocuments,
  deleteDocument,
} = require("../../controllers/document center/controller");
const {
  validateCreateDocument,
} = require("../../validators/document center/validator");

const router = express.Router();

router.post("/", validateCreateDocument, checkAccess, createDocument);
router.get("/", checkAccess, getDocuments);
router.delete("/:id", checkAccess, deleteDocument);

module.exports = router;
