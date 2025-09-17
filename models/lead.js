const mongoose = require("mongoose");
const offerModel = require("./offer");
const notificationModel = require("./notification");

const leadSchema = mongoose.Schema(
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
    leadtype: {
      type: String,
      enum: ["Company", "People"],
      default: "Company",
    },
    status: {
      type: String,
      enum: [
        "Draft",
        "New",
        "In Negotiation",
        "Completed",
        "Loose",
        "Cancelled",
        "Assigned",
        "On Hold",
        "Follow Up",
      ],
      default: "Draft",
    },
    source: {
      type: String,
      enum: [
        "Linkedin",
        "Social Media",
        "Website",
        "Advertising",
        "Friend",
        "Professionals Network",
        "Customer Referral",
        "Sales",
        "Digital Marketing",
        "Upwork",
        "Gem",
        "Freelancer",
        "IndiaMart",
        "Fiverr"
      ],
      default: "Social Media",
    },
    products: {
      type: [
        {
          type: mongoose.Types.ObjectId,
          ref: "Product",
        },
      ],
      required: true,
    },
    people: {
      type: mongoose.Types.ObjectId,
      ref: "People",
    },
    company: {
      type: mongoose.Types.ObjectId,
      ref: "Company",
    },
    notes: {
      type: String,
    },
    assigned: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
    },
    followup_date: {
      type: Date,
    },
    followup_reason: {
      type: String,
    },
    location: {
      type: String,
    },
    dataBank: {
      type: Boolean,
      default: false,
      required:true
    },
    prc_qt: {
      type: String,
    },
    leadCategory: {
      type: String,
      enum:[
        'Hot',
        'Cold',
        'Warm'
      ]
    },
    
  },
  
  { timestamps: true }
);

leadSchema.pre(
  "deleteMany",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await offerModel.deleteMany({ lead: docToDelete._id });
      await notificationModel.deleteOne({ lead: docToDelete._id });
    }
    next();
  }
);

leadSchema.pre(
  "deleteOne",
  { document: true, query: true },
  async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete?._id !== undefined) {
      await offerModel.deleteMany({ lead: docToDelete._id });
      await notificationModel.deleteOne({ lead: docToDelete._id });
    }
    next();
  }
);

const leadModel = mongoose.model("Lead", leadSchema);

module.exports = leadModel;
