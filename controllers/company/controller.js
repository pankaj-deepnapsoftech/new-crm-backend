const { omitUndefined } = require("mongoose");
const { TryCatch, ErrorHandler } = require("../../helpers/error");
const companyModel = require("../../models/company");

const createCompany = TryCatch(async (req, res) => {
  const { companyname, email, website, contact, phone, gst_no } = req.body;

  let isExistingCompany = await companyModel.findOne({ email });
  if (isExistingCompany) {
    throw new ErrorHandler(
      "A corporate with this email id is already registered",
      409
    );
  }
  isExistingCompany = await companyModel.findOne({ phone });
  if (isExistingCompany) {
    throw new ErrorHandler(
      "A corparate with this phone no. id is already registered",
      409
    );
  }

  const company = await companyModel.create({
    organization: req.user.organization,
    creator: req.user.id,
    companyname: companyname,
    email: email,
    contact: contact,
    phone: phone,
    website: website,
    gst_no: gst_no
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Corporate has been created successfully",
    company: company,
  });
});

const editCompany = TryCatch(async (req, res) => {
  const { companyId, name, email, website, contact, phone, gst_no } = req.body;

  const company = await companyModel.findById(companyId);

  if (!company) {
    throw new ErrorHandler("Corporate not found", 404);
  }

  let isExistingCompany = await companyModel.findOne({ email });
  if (isExistingCompany && company.email !== email) {
    throw new ErrorHandler(
      "A corporate with this email id is already registered",
      409
    );
  }
  isExistingCompany = await companyModel.findOne({ phone });
  if (isExistingCompany && company.phone !== phone) {
    throw new ErrorHandler(
      "A corparate with this phone no. id is already registered",
      409
    );
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingCompany.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to edit this corporate", 401);
  }

  const updatedCompany = await companyModel.findOneAndUpdate(
    { _id: companyId },
    { name, email, phone, contact, website, gst_no },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Corporate details has been updated successfully.",
    company: updatedCompany,
  });
});

const deleteCompany = TryCatch(async (req, res) => {
  const { companyId } = req.body;

  const company = await companyModel.findById(companyId);

  if (!company) {
    throw new ErrorHandler("Corporate not found", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    company.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to delete this corporate", 401);
  }

  const deletedCompany = await companyModel.deleteOne({ _id: companyId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Corporate has been deleted successfully",
    company: deletedCompany,
  });
});

const companyDetails = TryCatch(async (req, res) => {
  const { companyId } = req.body;

  const company = await companyModel.findById(companyId);
  if (!company) {
    throw new ErrorHandler("Corporate doesn't exists", 400);
  }
  if (
    req.user.role !== "Super Admin" &&
    company.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to access this corporate", 401);
  }

  res.status(200).json({
    status: 200,
    success: true,
    company: company,
  });
});

const allCompanies = TryCatch(async (req, res) => {
  const { page = 1 } = req.body;

  let companies = [];
  if (req.user.role === "Super Admin") {
    companies = await companyModel.find({organization: req.user.organization}).sort({ createdAt: -1 }).populate('creator', 'name');
  } else {
    companies = await companyModel
      .find({ creator: req.user.id })
      .sort({ createdAt: -1 }).populate('creator', 'name');
  }

  res.status(200).json({
    status: 200,
    success: true,
    companies: companies,
  });
});

module.exports = {
  createCompany,
  editCompany,
  deleteCompany,
  companyDetails,
  allCompanies,
};
