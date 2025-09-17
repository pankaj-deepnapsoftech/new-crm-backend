const mongoose = require("mongoose");
const customerModel = require("./customer");
const proformaInvoiceModel = require("./proformaInvoice");
const invoiceModel = require("./invoice");
const leadModel = require("./lead");
const indiamartLeadModel = require("./indiamart_lead");

const companySchema = mongoose.Schema(
  {
    organization: {
      type: mongoose.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is a required field"],
    },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
      required: [true, "creator is a required field"],
    },
    companyname: {
      type: String,
      required: [true, "corporate name is a required field"],
    },
    email: {
      type: String,
      // required: [true, "email is a required field"],
    },
    contact: {
      type: String,
    },
    phone: {
      type: String,
    },
    website: {
      type: String,
    },
    gst_no: {
      type: String,
    },
  },
  { timestamps: true }
);

companySchema.pre(
  "create",
  { document: true, query: true },
  async function (next) {
    const docToCreate = await this.model.create(this.getQuery(), {
      ignoreUndefined: true,
    });
    next();
  }
);

companySchema.pre(
  "deleteOne",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await customerModel.deleteMany({ company: docToDelete._id });
      await proformaInvoiceModel.deleteMany({ company: docToDelete._id });
      await leadModel.deleteMany({ company: docToDelete._id });
      await indiamartLeadModel.deleteMany({ company: docToDelete._id });
    }
    next();
  }
);

companySchema.pre(
  "deleteMany",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await customerModel.deleteMany({ company: docToDelete._id });
      await proformaInvoiceModel.deleteMany({ company: docToDelete._id });
      await leadModel.deleteMany({ company: docToDelete._id });
      await indiamartLeadModel.deleteMany({ company: docToDelete._id });
    }
    next();
  }
);

const companyModel = mongoose.model("Company", companySchema);

module.exports = companyModel;
