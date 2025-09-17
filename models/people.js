const mongoose = require("mongoose");
const customerModel = require("./customer");
const proformaInvoiceModel = require("./proformaInvoice");
const invoiceModel = require("./invoice");
const leadModel = require("./lead");
const indiamartLeadModel = require("./indiamart_lead");

const peopleSchema = mongoose.Schema(
  {
    organization: {
      type: mongoose.Types.ObjectId,
      ref: "Organization",
      required: [true, "organization is a required field"],
    },
    // organization: {
    //   type: mongoose.Types.ObjectId,
    //   ref: "Organization",
    //   required: [true, "Organization is a required field"],
    // },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
      required: [true, "creator is a required field"],
    },
    firstname: {
      type: String,
      required: [true, "firstname is a required field"],
    },
    lastname: {
      type: String,
      // required: [true, "lastname is a required field"],
    },
    email: {
      type: String,
      // required: [true, "email is a required field"],
    },
    phone: {
      type: String,
      // required: [true, "phone is a required field"],
    },
    otp: {
      type: Number,
    },
    expiry: {
      type: String,
    },
    verify: {
      type: Boolean,
    },
    emailSentDate: {
      type: Date,
    },
    whatsappSentDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

peopleSchema.pre(
  "create",
  { document: true, query: true },
  async function (next) {
    const docToCreate = await this.model.create(this.getQuery(), {
      ignoreUndefined: true,
    });
    next();
  }
);

peopleSchema.pre(
  "deleteOne",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await customerModel.deleteMany({ people: docToDelete._id });
      await proformaInvoiceModel.deleteMany({ people: docToDelete._id });
      await leadModel.deleteMany({ people: docToDelete._id });
      await indiamartLeadModel.deleteMany({ people: docToDelete._id });
    }
    next();
  }
);

peopleSchema.pre(
  "deleteMany",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await customerModel.deleteMany({ people: docToDelete._id });
      await proformaInvoiceModel.deleteMany({ people: docToDelete._id });
      await leadModel.deleteMany({ people: docToDelete._id });
      await indiamartLeadModel.deleteMany({ people: docToDelete._id });
    }
    next();
  }
);

const peopleModel = mongoose.model("People", peopleSchema);

module.exports = peopleModel;
