const { SendMail, SendBulkMail } = require("../../config/nodeMailer.config");
const { TryCatch, ErrorHandler } = require("../../helpers/error");
const customerModel = require("../../models/customer");
const invoiceModel = require("../../models/invoice");
const leadModel = require("../../models/lead");
const offerModel = require("../../models/offer");
const paymentModel = require("../../models/payment");
const peopleModel = require("../../models/people");
const proformaInvoiceModel = require("../../models/proformaInvoice");
const { generateOTP } = require("../../utils/generateOtp");

const createPeople = TryCatch(async (req, res) => {
  // const {firstname, lastname, company, email, phone} = req.body;
  const { firstname, lastname, email, phone } = req.body;

  let isExistingPeople = await peopleModel.findOne({ email });
  if (isExistingPeople) {
    throw new Error("Person with this email id already exists", 409);
  }

  isExistingPeople = await peopleModel.findOne({ phone });
  if (isExistingPeople) {
    throw new Error("Person with this phone no. already exists", 409);
  }

  // let person;

  // if(company === ''){
  //     person = await peopleModel.create({
  //         firstname, lastname, email, phone
  //     })
  // }
  // else{
  //     person = await peopleModel.create({
  //         firstname, lastname, company, email, phone
  //     })
  // }

  const { otp, expiresAt } = generateOTP();

  SendMail(
    "OtpVerification.ejs",
    { userName: firstname, otp },
    { email, subject: "OTP Verification" }
  );

  const person = await peopleModel.create({
    organization: req.user.organization,
    creator: req.user.id,
    firstname,
    lastname,
    email,
    phone,
    otp,
    expiry: expiresAt,
    verify: false,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Person has been created successfully",
    person: person,
  });
});

const editPeople = TryCatch(async (req, res) => {
  //   const { peopleId, firstname, lastname, email, phone, company } = req.body;
  const { peopleId, firstname, lastname, email, phone } = req.body;

  const isExistingPerson = await peopleModel.findById(peopleId);

  if (!isExistingPerson) {
    throw new Error("Person not found", 404);
  }
  if (
    req.user.role !== "Super Admin" &&
    isExistingPerson.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to edit this individual", 401);
  }

  const isEmailTaken = await peopleModel.findOne({ email: email });
  if (isEmailTaken && isExistingPerson.email !== email) {
    throw new Error("Email id is already registered with us.");
  }

  const isPhoneTaken = await peopleModel.findOne({ phone: phone });
  if (isPhoneTaken && isExistingPerson.phone !== phone) {
    throw new Error("Phone no. is already registered with us.");
  }

  const updatedPerson = await peopleModel.findOneAndUpdate(
    { _id: peopleId },
    {
      firstname,
      lastname,
      email,
      phone,
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Person's details has been updated successfully",
    updatedPerson: updatedPerson,
  });
});

const deletePeople = TryCatch(async (req, res) => {
  const { peopleId } = req.body;

  const isExistingPeople = await peopleModel.findById(peopleId);

  if (!isExistingPeople) {
    throw new ErrorHandler("Person not found", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingPeople.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to delete this individual", 401);
  }

  const deletedPerson = await peopleModel.deleteOne({ _id: peopleId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Person has been deleted successfully",
    deletedPerson: deletedPerson,
  });
});

const personDetails = TryCatch(async (req, res) => {
  const { peopleId } = req.body;

  let person = await peopleModel.findById(peopleId);
  // .populate("company", "companyname");
  if (!person) {
    throw new ErrorHandler("Person doesn't exists", 400);
  }

  if (
    req.user.role !== "Super Admin" &&
    person.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to access this individual", 401);
  }

  person = {
    _id: person._id,
    firstname: person.firstname,
    lastname: person.lastname,
    email: person.email,
    phone: person.phone,
    // company: person?.company ? person.company.companyname : "",
  };

  res.status(200).json({
    status: 200,
    success: true,
    person: person,
  });
});

const allPersons = TryCatch(async (req, res) => {
  let people = [];

  if (req.user.role === "Super Admin") {
    people = await peopleModel
      .find({ organization: req.user.organization })
      .sort({ createdAt: -1 })
      .populate("creator", "name");
  } else {
    people = await peopleModel
      .find({ creator: req.user.id })
      .sort({ createdAt: -1 })
      .populate("creator", "name");
  }

  const results = people.map((p) => {
    return {
      _id: p._id,
      firstname: p.firstname,
      lastname: p.lastname,
      phone: p.phone,
      email: p.email,
      verify: p.verify,
      creator: p.creator.name,
      createdAt: p.createdAt,
    };
  });

  res.status(200).json({
    status: 200,
    success: true,
    people: results,
  });
});

const OtpVerification = TryCatch(async (req, res) => {
  const { otp } = req.body;
  const { id } = req.params;

  const find = await peopleModel.findById(id);
  if (!find) {
    return res.status(404).json({
      message: "user not found",
    });
  }
  const date = Date.now();
  if (date > find.expiry) {
    return res.status(400).json({
      message: "OTP expired",
    });
  }

  if (otp !== find.otp) {
    return res.status(404).json({
      message: "Wrong OTP",
    });
  }

  await peopleModel.findByIdAndUpdate(id, { verify: true });
  return res.status(200).json({
    message: "OTP Verifyed Successful",
    success: true,
  });
});

const ResendOTP = TryCatch(async (req, res) => {
  const { id } = req.params;
  const find = await peopleModel.findById(id);
  if (!find) {
    return res.status(404).json({
      message: "Wrong User",
    });
  }

  const { otp, expiresAt } = generateOTP();

  SendMail(
    "OtpVerification.ejs",
    { userName: find.firstname, otp },
    { email: find.email, subject: "OTP Verification" }
  );

  await peopleModel.findByIdAndUpdate(id, { otp, expiry: expiresAt });
  return res.status(200).json({
    message: "Resend OTP",
  });
});

const VerifyedPeople = TryCatch(async (_req, res) => {
  const data = await peopleModel
    .find({ verify: true })
    .sort({ _id: -1 })
    .populate("creator", "name");

  const verified = data.map((item) => ({
    _id: item._id,
    firstname: item.firstname,
    lastname: item.lastname,
    email: item.email,
    phone: item.phone,
    verify: item.verify,
    creator: item.creator.name,
    createdAt: item.createdAt,
  }));

  return res.status(200).json({
    message: "data",
    data: verified,
  });
});

const SendBulkEmailVerifiedUser = TryCatch(async (req, res) => {
  const { message, subject } = req.body;
  const data = await peopleModel
    .find({ verify: true })
    .sort({ _id: -1 })
    .populate("creator", "name");

  for (let person of data) {
    // Set the emailSentDate for each person
    person.emailSentDate = Date.now();

    // Save the updated document
    await person.save();
  }

  console.log(data);

  const email = data.map((item) => [item?.email]);
  await SendBulkMail({ email, message, subject });
  return res.status(200).json({
    message: "Mail send successful",
  });
});

const getAllEmailSentData = TryCatch(async (req, res) => {
  const data = await peopleModel
    .find({ emailSentDate: { $exists: true } }) // This ensures the field exists
    .populate("creator", "name");

  return res.status(200).json({
    data,
  });
});
const getAllWhatsappSentData = TryCatch(async (req, res) => {
  const data = await peopleModel
    .find({ whatsappSentDate: { $exists: true } })
    .populate("creator", "name");

  return res.status(200).json({
    data,
  });
});

module.exports = {
  createPeople,
  editPeople,
  deletePeople,
  personDetails,
  allPersons,
  OtpVerification,
  ResendOTP,
  VerifyedPeople,
  SendBulkEmailVerifiedUser,
  getAllEmailSentData,
  getAllWhatsappSentData,
};
