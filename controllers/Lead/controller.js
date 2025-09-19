const csv = require("csvtojson");
const fs = require("fs");
const { TryCatch, ErrorHandler } = require("../../helpers/error");
const peopleModel = require("../../models/people");
const companyModel = require("../../models/company");
const leadModel = require("../../models/lead");
const customerModel = require("../../models/customer");
const notificationModel = require("../../models/notification");
const mongoose = require("mongoose");
const indiamartLeadModel = require("../../models/indiamart_lead");
const { emitEvent } = require("../../helpers/socket");
const adminModel = require("../../models/admin");
const websiteConfigurationModel = require("../../models/websiteConfiguration");
const sendSms = require("../../utils/sendSms");
const { sendEmail, sendBusinessEmail } = require("../../helpers/sendEmail");
const productModel = require("../../models/product");
const { capitalizeFirstChar } = require("../../utils/capitalize");
const { parse } = require("json2csv");
const path = require("path");

const createLead = TryCatch(async (req, res) => {
  const {
    leadtype,
    status,
    source,
    peopleId,
    companyId,
    notes,
    products,
    assigned,
    followup_date,
    followup_reason,
    location,
    prc_qt,
    leadCategory,
    demoPdf,
  } = req.body;
  const demoPdfToSave = demoPdf || (req.file ? req.file.path : null);

  const websiteCofiguration = await websiteConfigurationModel
    .findOne({
      organization: req.user.organization,
    })
    .populate("organization");
  const {
    sms_api_key,
    sms_api_secret,
    sms_sender_id,
    sms_welcome_template_id,
    sms_dealdone_template_id,
    sms_entity_id,
    email_id,
    email_password,
    organization,
  } = websiteCofiguration;

  if (leadtype === "People" && peopleId) {
    const isExistingPeople = await peopleModel.findById(peopleId);

    if (!isExistingPeople) {
      throw new Error("Person doesn't exists", 400);
    }

    let lead = await leadModel.create({
      creator: req.user.id,
      organization: req.user.organization,
      leadtype,
      status,
      source,
      people: peopleId,
      notes,
      products,
      assigned,
      followup_date,
      followup_reason,
      prc_qt,
      location,
      leadCategory,
      demoPdf: demoPdfToSave,
    });
    lead = await leadModel.findById(lead._id).populate("products");

    // Lead completed, now make the person customer
    if (status === "Completed") {
      const isExistingCustomer = await customerModel.findOne({
        people: peopleId,
      });
      if (!isExistingCustomer) {
        const customer = await customerModel.create({
          organization: lead.organization,
          creator: lead.creator,
          customertype: leadtype,
          people: peopleId,
          products,
        });
      }
    } else if (status === "Follow Up") {
      const date = new Date();
      const followupDate = new Date(lead?.followup_date);
      if (
        date.getFullYear() === followupDate.getFullYear() &&
        date.getMonth() === followupDate.getMonth() &&
        date.getDate() === followupDate.getDate()
      ) {
        const creator = await adminModel.findById(lead.creator);
        const receivers = [{ email: creator.email }];
        await notificationModel.create({
          organization: req.user.organization,
          author: creator._id,
          message: `You have a new lead of ${
            isExistingPeople.firstname +
            (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
          } for follow up`,
        });

        emitEvent(
          req,
          "NEW_FOLLOWUP_LEAD",
          receivers,
          `You have a new lead of ${
            isExistingPeople.firstname +
            (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
          } for follow up`
        );
      }
    } else if (status === "Assigned") {
      const assignedTo = await adminModel.findById(lead?.assigned);
      const receivers = [{ email: assignedTo.email }];
      await notificationModel.create({
        organization: req.user.organization,
        author: assignedTo._id,
        message: `${
          isExistingPeople.firstname +
          (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
        }'s lead has been assigned to you`,
      });

      emitEvent(
        req,
        "NEW_ASSIGNED_LEAD",
        receivers,
        `${
          isExistingPeople.firstname +
          (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
        }'s lead has been assigned to you`
      );
    }

    // SEND SMS
    if (
      status === "New" &&
      sms_api_key &&
      sms_api_secret &&
      sms_sender_id &&
      sms_welcome_template_id &&
      sms_entity_id &&
      isExistingPeople?.phone
    ) {
      const message = `Dear ${isExistingPeople?.firstname}, Welcome to Itsybizz! We're thrilled to have you on board and ready to support your business journey. Let's succeed together!`;
      try {
        if (
          sms_api_key &&
          sms_api_secret &&
          sms_sender_id &&
          sms_welcome_template_id &&
          sms_entity_id &&
          isExistingPeople?.phone
        ) {
          await sendSms(
            sms_api_key,
            sms_api_secret,
            isExistingPeople.phone,
            sms_welcome_template_id,
            sms_sender_id,
            sms_entity_id,
            message
          );
        }
      } catch (err) {
        console.error("Failed to send lead SMS (people):", err);
      }
    } else if (
      status === "Completed" &&
      sms_api_key &&
      sms_api_secret &&
      sms_sender_id &&
      sms_dealdone_template_id &&
      sms_entity_id &&
      isExistingPeople?.phone
    ) {
      const message = `Hi ${isExistingPeople?.firstname}, your purchase of ${lead?.products[0].name} is confirmed! Thank you for choosing us. Feel free to reach out at +919205404075.-ITSYBIZZ`;
      sendSms(
        sms_api_key,
        sms_api_secret,
        isExistingPeople?.phone,
        sms_dealdone_template_id,
        sms_sender_id,
        sms_entity_id,
        message
      );
    }

    // SEND EMAIL
    if (
      status === "New" &&
      email_id &&
      email_password &&
      isExistingPeople?.email
    ) {
      const subject = ` Welcome to ${organization?.company}`;
      const message = `<p>Dear <strong>${isExistingPeople?.firstname}</strong>,</p>
                        <br>
                        <p>Welcome to ${organization?.company}! We’re thrilled to have you on board and are excited to support you on your business journey</p>
                                        <br>
                                        <p>Our team is dedicated to helping you succeed, and we’re here to provide the resources and assistance you need every step of the way. If you have any questions or need guidance, please don’t hesitate to reach out.</p>
                                        <br>
                                        <p>Let’s succeed together!</p>
                                        <br>
                                        <p>Best regards,</p>
                                        <p>The ${organization?.company} Team</>`;
      try {
        if (email_id && email_password && isExistingPeople?.email) {
          await sendBusinessEmail(
            isExistingPeople.email,
            subject,
            message,
            email_id,
            email_password
          );
        }
      } catch (err) {
        console.error("Failed to send lead email (people):", err);
      }
    } else if (
      status === "Completed" &&
      email_id &&
      email_password &&
      isExistingPeople?.email
    ) {
      const subject = `Your Purchase with ITSYBIZZ is Confirmed!`;
      const message = `<p>Dear <strong>${isExistingPeople?.firstname}</strong>,</p>
      <br>
                       <p>Thank you for completing your purchase of ${lead?.products[0]?.name}! We're thrilled to have you with us and are committed to providing you with the best experience.</p>
      <br>
  
                       <p>If you have any questions or need assistance, please don't hesitate to reach out at <strong>+91 92054 04075</strong> reply to this email.</p>
      <br>
                       <p>Thank you once again for choosing ${organization?.company}!</p>
      <br>
  
                       <p>Warm regards,</p>
                       <p>The ${organization?.company} Team</p>`;

      sendBusinessEmail(
        isExistingPeople?.email,
        subject,
        message,
        email_id,
        email_password
      );
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Lead has been created successfully",
      lead: lead,
    });
  } else if (leadtype === "Company" && companyId) {
    const isExistingCompany = await companyModel.findById(companyId);

    if (!isExistingCompany) {
      throw new Error("Corporate doesn't exists", 400);
    }

    let lead = await leadModel.create({
      organization: req.user.organization,
      creator: req.user.id,
      leadtype,
      status,
      source,
      company: companyId,
      notes,
      followup_date,
      followup_reason,
      prc_qt,
      location,
      leadCategory,
    });
    lead = await leadModel.findById(lead._id).populate("products");

    // Lead completed, now make the company customer
    if (status === "Completed") {
      const isExistingCustomer = await customerModel.findOne({
        company: companyId,
      });

      if (!isExistingCustomer) {
        const customer = await customerModel.create({
          organization: lead.organization,
          creator: lead.creator,
          customertype: leadtype,
          company: companyId,
          products,
        });
      }
    } else if (status === "Follow Up") {
      const date = new Date();
      const followupDate = new Date(lead?.followup_date);
      if (
        date.getFullYear() === followupDate.getFullYear() &&
        date.getMonth() === followupDate.getMonth() &&
        date.getDate() === followupDate.getDate()
      ) {
        const creator = await adminModel.findById(lead.creator);
        const receivers = [{ email: creator.email }];
        await notificationModel.create({
          organization: req.user.organization,
          author: creator._id,
          message: `You have a new lead of ${isExistingCompany.companyname} for follow up`,
        });

        emitEvent(
          req,
          "NEW_FOLLOWUP_LEAD",
          receivers,
          `You have a new lead of ${isExistingCompany.companyname} for follow up`
        );
      }
    } else if (status === "Assigned") {
      const assignedTo = await adminModel.findById(lead?.assigned);
      const receivers = [{ email: assignedTo.email }];
      await notificationModel.create({
        organization: req.user.organization,
        author: assignedTo._id,
        message: `${isExistingCompany.companyname}'s lead has been assigned to you`,
      });

      emitEvent(
        req,
        "NEW_ASSIGNED_LEAD",
        receivers,
        `${isExistingCompany.companyname}'s lead has been assigned to you`
      );
    }

    // SEND SMS
    if (
      status === "New" &&
      sms_api_key &&
      sms_api_secret &&
      sms_sender_id &&
      sms_welcome_template_id &&
      sms_entity_id &&
      isExistingCompany?.phone
    ) {
      const message = `Dear ${isExistingCompany?.companyname}, Welcome to Itsybizz! We're thrilled to have you on board and ready to support your business journey. Let's succeed together!`;

      sendSms(
        sms_api_key,
        sms_api_secret,
        isExistingCompany?.phone,
        sms_welcome_template_id,
        sms_sender_id,
        sms_entity_id,
        message
      );
    } else if (
      status === "Completed" &&
      sms_api_key &&
      sms_api_secret &&
      sms_sender_id &&
      sms_dealdone_template_id &&
      sms_entity_id &&
      isExistingCompany?.phone
    ) {
      const message = `Hi ${isExistingCompany?.companyname}, your purchase of ${lead?.products[0].name} is confirmed! Thank you for choosing us. Feel free to reach out at +919205404075.-ITSYBIZZ`;
      sendSms(
        sms_api_key,
        sms_api_secret,
        isExistingCompany?.companyname,
        sms_dealdone_template_id,
        sms_sender_id,
        sms_entity_id,
        message
      );
    }

    // SEND EMAIL
    if (
      status === "New" &&
      email_id &&
      email_password &&
      isExistingCompany?.email
    ) {
      const subject = ` Welcome to ${organization?.company}`;
      const message = `<p>Dear <strong>${isExistingCompany?.companyname}</strong>,</p>
                        <br>
                        <p>Welcome to ${organization?.company}! We’re thrilled to have you on board and are excited to support you on your business journey</p>
                                        <br>
                                        <p>Our team is dedicated to helping you succeed, and we’re here to provide the resources and assistance you need every step of the way. If you have any questions or need guidance, please don’t hesitate to reach out.</p>
                                        <br>
                                        <p>Let’s succeed together!</p>
                                        <br>
                                        <p>Best regards,</p>
                                        <p>The ${organization?.company} Team</p>`;

      sendBusinessEmail(
        isExistingCompany?.email,
        subject,
        message,
        email_id,
        email_password
      );
    } else if (
      status === "Completed" &&
      email_id &&
      email_password &&
      isExistingCompany?.email
    ) {
      const subject = `Your Purchase with ITSYBIZZ is Confirmed!`;
      const message = `<p>Dear <strong>${isExistingCompany?.companyname}</strong>,</p>
      <br>
                       <p>Thank you for completing your purchase of ${lead?.products[0]?.name}! We're thrilled to have you with us and are committed to providing you with the best experience.</p>
      <br>
  
                       <p>If you have any questions or need assistance, please don't hesitate to reach out at <strong>+91 92054 04075</strong> reply to this email.</p>
      <br>
                       <p>Thank you once again for choosing ${organization?.company}!</p>
      <br>
  
                       <p>Warm regards,</p>
                       <p>The ${organization?.company} Team</p>`;
      sendBusinessEmail(
        isExistingCompany?.email,
        subject,
        message,
        email_id,
        email_password
      );
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Lead has been created successfully",
      lead: lead,
    });
  }

  throw new ErrorHandler("Lead type must be Individual or Corporate");
});

const editLead = TryCatch(async (req, res) => {
  // const { leadId, leadtype, status, source, peopleId, companyId, notes } =
  //   req.body;
  const {
    leadId,
    status,
    source,
    notes,
    products,
    assigned,
    followup_date,
    followup_reason,
    prc_qt,
    location,
    leadCategory,
  } = req.body;

  const isExistingLead = await leadModel
    .findById(leadId)
    .populate("people")
    .populate("company")
    .populate("products");
  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists", 400);
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingLead.creator.toString() !== req.user.id.toString() &&
    isExistingLead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to edit this lead", 401);
  }

  if (
    (isExistingLead.status === "Follow Up" && status !== "Follow Up") ||
    (isExistingLead?.followup_date &&
      followup_date &&
      isExistingLead.followup_date !== followup_date)
  ) {
    await notificationModel.deleteOne({ lead: isExistingLead._id });
  }

  let updatedLead;

  if (status === "Assigned") {
    updatedLead = await leadModel
      .findOneAndUpdate(
        { _id: leadId },
        {
          $unset: { followup_date: "", followup_reason: "" },
          $set: {
            creator: req.user.id,
            status: status,
            assigned,
            notes,
            source,
            prc_qt,
            location,
            leadCategory,
          },
        },
        { new: true }
      )
      .populate("company")
      .populate("people");

    const name = updatedLead?.people
      ? updatedLead?.people?.firstname +
        (updatedLead?.people?.lastname
          ? " " + updatedLead?.people?.lastname
          : "")
      : updatedLead?.company?.companyname;

    const assignedTo = await adminModel.findById(updatedLead?.assigned);
    const receivers = [{ email: assignedTo.email }];

    await notificationModel.create({
      organization: req.user.organization,
      author: assignedTo._id,
      message: `${name}'s lead has been assigned to you`,
    });

    emitEvent(
      req,
      "NEW_ASSIGNED_LEAD",
      receivers,
      `${name}'s lead has been assigned to you`
    );
  } else if (
    status === "Follow Up" &&
    followup_date &&
    followup_reason
    // new Date(followup_date).toLocaleDateString() ===
    //   new Date().toLocaleDateString()
  ) {
    updatedLead = await leadModel
      .findOneAndUpdate(
        { _id: leadId },
        {
          $set: {
            status: status,
            followup_date,
            followup_reason,
            assigned,
            notes,
            source,
            prc_qt,
            location,
            leadCategory,
          },
        },
        { new: true }
      )
      .populate("company")
      .populate("people");

    const name = updatedLead?.people
      ? updatedLead?.people?.firstname +
        (updatedLead?.people?.lastname
          ? " " + updatedLead?.people?.lastname
          : "")
      : updatedLead?.company?.companyname;

    const creator = await adminModel.findById(updatedLead?.creator);
    const receivers = [{ email: creator.email }];

    await notificationModel.create({
      organization: req.user.organization,
      author: creator._id,
      message: `You have a new lead of ${name} for follow up`,
    });

    if (
      new Date(followup_date).toLocaleDateString() ===
      new Date().toLocaleDateString()
    ) {
      emitEvent(
        req,
        "NEW_FOLLOWUP_LEAD",
        receivers,
        `You have a new lead of ${name} for follow up`
      );
    }
  } else {
    updatedLead = await leadModel.findOneAndUpdate(
      { _id: leadId },
      {
        $unset: { followup_date: "", followup_reason: "" },
        $set: {
          status: status,
          source,
          notes,
          prc_qt,
          location,
          leadCategory,
          assigned,
        },
      },
      { new: true }
    );
  }

  if (status === "Completed") {
    let isExistingCustomer;
    if (isExistingLead?.people) {
      isExistingCustomer = await customerModel.findOne({
        people: isExistingLead.people,
      });
    }
    if (isExistingLead?.company) {
      isExistingCustomer = await customerModel.findOne({
        company: isExistingLead.company,
      });
    }

    if (!isExistingCustomer) {
      if (isExistingLead?.people) {
        await customerModel.create({
          organization: isExistingLead.organization,
          creator: isExistingLead.creator,
          customertype: isExistingLead.leadtype,
          people: isExistingLead.people,
          products,
        });
      } else {
        await customerModel.create({
          organization: isExistingLead.organization,
          creator: isExistingLead.creator,
          customertype: isExistingLead.leadtype,
          company: isExistingLead.company,
          products,
        });
      }
    }
  }

  const websiteCofiguration = await websiteConfigurationModel
    .findOne({
      organization: req.user.organization,
    })
    .populate("organization");
  const {
    sms_api_key,
    sms_api_secret,
    sms_sender_id,
    sms_welcome_template_id,
    sms_dealdone_template_id,
    sms_entity_id,
    email_id,
    email_password,
    organization,
  } = websiteCofiguration;

  // SEND SMS
  if (
    status === "New" &&
    sms_api_key &&
    sms_api_secret &&
    sms_sender_id &&
    sms_welcome_template_id &&
    sms_entity_id &&
    (isExistingLead?.people?.phone || isExistingLead?.company?.phone)
  ) {
    const message = `Dear ${
      isExistingLead?.people?.firstname || isExistingLead?.company?.companyname
    }, Welcome to Itsybizz! We're thrilled to have you on board and ready to support your business journey. Let's succeed together!`;

    await sendSms(
      sms_api_key,
      sms_api_secret,
      isExistingLead?.people?.phone || isExistingLead?.company?.phone,
      sms_welcome_template_id,
      sms_sender_id,
      sms_entity_id,
      message
    );
  } else if (
    status === "Completed" &&
    sms_api_key &&
    sms_api_secret &&
    sms_sender_id &&
    sms_dealdone_template_id &&
    sms_entity_id &&
    (isExistingLead?.people?.phone || isExistingLead?.company?.phone)
  ) {
    const message = `Hi ${
      isExistingLead?.people?.firstname || isExistingLead?.company?.companyname
    }, your purchase of ${
      isExistingLead?.products[0]?.name
    } is confirmed! Thank you for choosing us. Feel free to reach out at +919205404075.-ITSYBIZZ`;
    await sendSms(
      sms_api_key,
      sms_api_secret,
      isExistingLead?.people?.phone || isExistingLead?.company?.phone,
      sms_dealdone_template_id,
      sms_sender_id,
      sms_entity_id,
      message
    );
  }

  // SEND EMAIL
  if (
    status === "New" &&
    email_id &&
    email_password &&
    (isExistingLead?.people?.email || isExistingLead?.company?.email)
  ) {
    const subject = ` Welcome to ${organization?.company}`;
    const message = `<p>Dear <strong>${
      isExistingLead?.people?.firstname || isExistingLead?.company?.companyname
    }</strong>,</p>
    <br>
    <p>Welcome to ${
      organization?.company
    }! We’re thrilled to have you on board and are excited to support you on your business journey</p>
                     <br>
                     <p>Our team is dedicated to helping you succeed, and we’re here to provide the resources and assistance you need every step of the way. If you have any questions or need guidance, please don’t hesitate to reach out.</p>
                     <br>
                     <p>Let’s succeed together!</p>
                     <br>
                     <p>Best regards,</p>
                     <p>The ${organization?.company} Team</>`;

    sendBusinessEmail(
      isExistingLead?.people?.email || isExistingLead?.company?.email,
      subject,
      message,
      email_id,
      email_password
    );
  } else if (
    status === "Completed" &&
    email_id &&
    email_password &&
    (isExistingLead?.people?.email || isExistingLead?.company?.email)
  ) {
    const subject = `Your Purchase with ITSYBIZZ is Confirmed!`;
    const message = `<p>Dear <strong>${
      isExistingLead?.people?.firstname || isExistingLead?.company?.companyname
    }</strong>,</p>
    <br>
                     <p>Thank you for completing your purchase of ${
                       isExistingLead?.products[0]?.name
                     }! We're thrilled to have you with us and are committed to providing you with the best experience.</p>
    <br>

                     <p>If you have any questions or need assistance, please don't hesitate to reach out at <strong>+91 92054 04075</strong> reply to this email.</p>
    <br>
                     <p>Thank you once again for choosing ${
                       organization?.company
                     }!</p>
    <br>

                     <p>Warm regards,</p>
                     <p>The ${organization?.company} Team</p>`;
    sendBusinessEmail(
      isExistingLead?.people?.email || isExistingLead?.company?.email,
      subject,
      message,
      email_id,
      email_password
    );
  }

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Lead has been updated successfully",
    updatedLead: updatedLead,
  });
});

const bulkAssign = TryCatch(async (req, res) => {
  const { leads, assignedTo } = req.body;

  if (!leads || !assignedTo) {
    throw new Error("Please provide all the fields", 400);
  }
  if (leads?.length === 0) {
    throw new Error("Select atleast 1 lead", 400);
  }

  await leadModel.updateMany(
    { _id: leads },
    { status: "Assigned", assigned: assignedTo },
    { new: true }
  );

  const assigned = await adminModel.findById(assignedTo);
  const receivers = [{ email: assigned?.email }];

  await notificationModel.create({
    organization: req.user.organization,
    author: assigned?._id,
    message: `Leads have been assigned to you`,
  });

  emitEvent(
    req,
    "NEW_ASSIGNED_LEAD",
    receivers,
    `Leads have been assigned to you`
  );

  res.status(200).json({
    success: true,
    status: 200,
    message: "Assigned successfully",
  });
});

const deleteLead = TryCatch(async (req, res) => {
  const { leadId } = req.body;

  const isExistingLead = await leadModel.findById(leadId);

  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists");
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingLead.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to delete this lead", 401);
  }

  const deletedLead = await leadModel.deleteOne({ _id: leadId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Lead has been deleted successfully",
    deletedLead: deletedLead,
  });
});

const deleteAllLead = TryCatch(async (req, res) => {
  if (req.user.role !== "Super Admin") {
    throw new Error("You are not allowed to delete all leads", 401);
  }

  await leadModel.deleteMany();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Leads have been deleted successfully",
  });
});

const leadDetails = TryCatch(async (req, res) => {
  const { leadId } = req.body;
  const lead = await leadModel
    .findById(leadId)
    .populate("people", "firstname lastname email phone")
    .populate("company", "companyname email phone")
    .populate("assigned", "name phone email")
    .populate({
      path: "products",
      populate: [
        {
          path: "category",
          model: "Product Category",
          select: "categoryname",
        },
      ],
    });

  if (!lead) {
    throw new ErrorHandler("Lead doesn't exists", 400);
  }

  if (
    req.user.role !== "Super Admin" &&
    lead.creator.toString() !== req.user.id.toString() &&
    lead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to access this lead", 401);
  }

  res.status(200).json({
    status: 200,
    success: true,
    lead: lead,
  });
});

const allLeads = TryCatch(async (req, res) => {
  const { page = 1 } = req.body;
  // const totalLeadsPerPage = 10;
  // const skip = (page-1)*totalLeadsPerPage;

  let leads = [];
  if (req.user.role === "Super Admin") {
    // console.log(req.user.organization);
    leads = await leadModel
      .find({ organization: req.user.organization })
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");
  } else {
    leads = await leadModel
      .find({ organization: req.user.organization, creator: req.user.id })
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");
  }
  // console.log(leads)
  const results = leads.map((lead) => {
    // .filter((lead) => lead.status === "active")
    return {
      _id: lead._id,
      name:
        lead.people !== undefined
          ? lead?.people?.firstname + " " + (lead?.people?.lastname || "")
          : lead?.company?.companyname,
      status: lead.status,
      email:
        lead.people !== undefined ? lead?.people?.email : lead?.company?.email,
      phone:
        lead.people !== undefined ? lead?.people?.phone : lead?.company?.phone,
      source: lead.source,
      leadtype: lead.leadtype,
      assigned: lead?.assigned?.name,
      followup_date: lead?.followup_date,
      followup_reason: lead?.followup_reason,
      creator: lead?.creator?.name,
      createdAt: lead?.createdAt,
      location: lead?.location,
      prc_qt: lead?.prc_qt,
      leadCategory: lead?.leadCategory,
      dataBank: lead?.dataBank,
      demoPdf: lead?.demoPdf,
      demo: lead?.demo,
    };
  });

  res.status(200).json({
    status: 200,
    success: true,
    leads: results,
  });
});

const assignedLeads = TryCatch(async (req, res) => {
  const user = req.user.id;

  const leads = await leadModel
    .find({
      organization: req.user.organization,
      assigned: { $exists: true, $ne: null },
      $or: [{ creator: user }, { assigned: user }],
    })
    .sort({ createdAt: -1 })
    .populate("people", "-_id firstname lastname email phone")
    .populate("company", "-_id companyname email phone")
    .populate("assigned", "name")
    .populate("creator", "name");

  // console.log(leads);
  // console.log(req.user.organization);
  // console.log(user)

  const indiamartLeads = await indiamartLeadModel
    .find({
      organization: req.user.organization,
      assigned: { $exists: true, $ne: null },
      assigned: user,
    })
    .sort({ createdAt: -1 })
    .populate("assigned", "name");

  const results = leads.map((lead) => {
    return {
      _id: lead._id,
      name:
        lead.people !== undefined
          ? lead.people.firstname + " " + (lead?.people?.lastname || "")
          : lead.company.companyname,
      status: lead.status,
      email:
        lead.people !== undefined ? lead?.people.email : lead?.company?.email,
      phone:
        lead.people !== undefined ? lead?.people?.phone : lead?.company?.phone,
      source: lead.source,
      leadtype: lead.leadtype,
      assigned: lead?.assigned?.name,
      followup_date: lead?.followup_date,
      followup_reason: lead?.followup_reason,
      creator: lead?.creator?.name,
      createdAt: lead?.createdAt,
      location: lead?.location,
      prc_qt: lead?.prc_qt,
    };
  });

  results.push(
    ...indiamartLeads.map((lead) => {
      return {
        _id: lead._id,
        name: lead?.SENDER_NAME,
        status: lead?.status,
        email: lead?.SENDER_EMAIL || lead?.SENDER_EMAIL_ALT,
        phone: lead?.SENDER_MOBILE || lead?.SENDER_MOBILE_ALT,
        source: "Indiamart",
        leadtype: "Indiamart",
        assigned: lead?.assigned?.name,
        followup_date: lead?.followup_date,
        followup_reason: lead?.followup_reason,
        creator: "Indiamart",
        createdAt: lead?.QUERY_TIME,
      };
    })
  );

  res.status(200).json({
    status: 200,
    success: true,
    leads: results,
  });
});

// const followupReminders = TryCatch(async (req, res) => {
//   const user = req.user.id;
//   const date = new Date();

//   const leadsForFollowUp = await leadModel
//     .find({
//       organization: req.user.organization,
//       $or: [{ creator: user }, { assigned: user }],
//       status: "Follow Up",
//     })
//     .populate("people", "firstname lastname")
//     .populate("company", "companyname");

//   const indiamartleadsForFollowUp = await indiamartLeadModel
//     .find({
//       organization: req.user.organization,
//       $or: [{ creator: user }, { assigned: user }],
//       status: "Follow Up",
//     })
//     .populate("people", "firstname lastname")
//     .populate("company", "companyname");

//   let notifications = await Promise.all(
//     leadsForFollowUp.map(async (lead) => {
//       const followupDate = new Date(lead?.followup_date);
//       if (
//         date.getFullYear() === followupDate.getFullYear() &&
//         date.getMonth() === followupDate.getMonth() &&
//         date.getDate() === followupDate.getDate()
//       ) {
//         const doesNotificationExists = await notificationModel.findOne({
//           lead: lead._id,
//         });

//         if (doesNotificationExists) {
//           return doesNotificationExists;
//         }

//         let customerName = lead?.people
//           ? lead.people.firstname + " " + (lead.people.lastname || "")
//           : lead.company.companyname;

//         return await notificationModel.create({
//           lead: lead._id,
//           leadtype: "CRM",
//           message: `${customerName} had asked you for follow-up today`,
//         });
//       }

//       return null;
//     })
//   );
//   notifications.push(
//     ...(await Promise.all(
//       indiamartleadsForFollowUp.map(async (lead) => {
//         const followupDate = new Date(lead?.followup_date);
//         if (
//           date.getFullYear() === followupDate.getFullYear() &&
//           date.getMonth() === followupDate.getMonth() &&
//           date.getDate() === followupDate.getDate()
//         ) {
//           const doesNotificationExists = await notificationModel.findOne({
//             lead: lead._id,
//           });

//           if (doesNotificationExists) {
//             return doesNotificationExists;
//           }

//           let customerName = lead?.people
//             ? lead.people.firstname + " " + (lead.people.lastname || "")
//             : lead.company.companyname;

//           return await notificationModel.create({
//             lead: lead._id,
//             leadtype: "Indiamart",
//             message: `${customerName} had asked you for follow-up today`,
//           });
//         }

//         return null;
//       })
//     ))
//   );

//   notifications = notifications.filter((notification) => notification !== null);

//   res.status(200).json({
//     status: 200,
//     success: true,
//     notifications,
//   });
// });

// const getUnseenNotfications = TryCatch(async (req, res) => {
//   const user = req.user.id;
//   const date = new Date();

//   const startOfDay = new Date(
//     date.toISOString().split("T")[0] + "T00:00:00.000Z"
//   );
//   const endOfDay = new Date(
//     date.toISOString().split("T")[0] + "T23:59:59.999Z"
//   );

//   const leadsForFollowUp = await leadModel.find({
//     organization: req.user.organization,
//     $or: [{ creator: user }, { assigned: user }],
//     status: "Follow Up",
//     followup_date: {
//       $gte: startOfDay,
//       $lt: endOfDay,
//     },
//   });
//   const indiamartleadsForFollowUp = await indiamartLeadModel.find({
//     organization: req.user.organization,
//     creator: user,
//     status: "Follow Up",
//     followup_date: {
//       $gte: startOfDay,
//       $lt: endOfDay,
//     },
//   });

//   const leadIds = [...leadsForFollowUp, ...indiamartleadsForFollowUp].map(
//     (lead) => lead._id
//   );

//   const unseenNotificationsCount = await notificationModel.countDocuments({
//     organization: req.user.organization,
//     lead: { $in: leadIds },
//     seen: false,
//   });

//   res.status(200).json({
//     status: 200,
//     success: true,
//     unseenNotifications: unseenNotificationsCount,
//   });
// });

// const seenFollowupReminders = TryCatch(async (req, res) => {
//   const { notifications } = req.body;

//   await Promise.all(
//     notifications.map(
//       async (notification) =>
//         await notificationModel.findByIdAndUpdate(notification, { seen: true })
//     )
//   );

//   res.status(200).json({});
// });

const leadSummary = TryCatch(async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.user.id);
  const organization = new mongoose.Types.ObjectId(req.user.organization);

  let leads;

  if (req.user.role === "Super Admin") {
    leads = await leadModel.aggregate([
      { $match: { organization: organization } },
      {
        $facet: {
          totalCount: [
            {
              $group: {
                _id: null,
                count: {
                  $sum: 1,
                },
              },
            },
          ],
          statusCount: [
            {
              $group: {
                _id: "$status",
                count: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                k: "$_id",
                v: "$count",
              },
            },
          ],
        },
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
          statusCount: {
            $arrayToObject: "$statusCount",
          },
        },
      },
    ]);
  } else {
    leads = await leadModel.aggregate([
      { $match: { organization: organization, creator: user } },
      {
        $facet: {
          totalCount: [{ $group: { _id: null, count: { $sum: 1 } } }],
          statusCount: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, k: "$_id", v: "$count" } },
          ],
        },
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
          statusCount: { $arrayToObject: "$statusCount" },
        },
      },
    ]);
  }

  res.status(200).json({
    status: 200,
    success: true,
    leads,
  });
});

const bulkUpload = async (req, res) => {
  csv()
    .fromFile(req.file.path)
    .then(async (response) => {
      // Remove the CSV file
      fs.unlink(req.file.path, () => {});

      await checkDataValidity(response);

      const customerPromise = response.map(async (data) => {
        if (data?.phone && data?.product) {
          if (data?.type?.toLowerCase() === "individual") {
            let isExistingPeople = await peopleModel.findOne({
              phone: data?.phone,
            });
            if (!isExistingPeople && data?.name && data?.phone) {
              const name = data?.name?.split(" ");
              isExistingPeople = await peopleModel.create({
                creator: req.user.id,
                organization: req.user.organization,
                firstname: name[0],
                lastname: name?.length > 1 ? name[1] : undefined,
                email: data?.email,
                phone: data?.phone,
              });
            }
            if (isExistingPeople) {
              const product = await productModel.findOne({
                name: data?.product,
              });
              return {
                creator: new mongoose.Types.ObjectId(req.user.id),
                organization: req.user.organization,
                leadtype: "People",
                status: data?.status,
                source: data?.source,
                followup_date:
                  data?.status === "Follow Up"
                    ? data?.followup_date
                    : undefined,
                followup_reason:
                  data?.status === "Follow Up"
                    ? data?.followup_reason
                    : undefined,
                people: isExistingPeople._id,
                products: product ? [product?._id] : null,
                remarks: data?.remarks,
                phone: data?.phone,
                email: data?.email,
                name: isExistingPeople?.firstname,
                productname: product?.name,
                leadCategory: data?.leadCategory,
              };
            }
          } else if (data?.type?.toLowerCase() === "corporate") {
            let isExistingCompany = await companyModel.findOne({
              phone: data?.phone,
            });
            if (!isExistingCompany && data?.companyname && data?.phone) {
              isExistingCompany = await companyModel.create({
                creator: req.user.id,
                organization: req.user.organization,
                companyname: data?.companyname,
                email: data?.email,
                phone: data?.phone,
                contact: data?.contact,
                website: data?.website,
                leadCategory: data?.leadCategory,
              });
            }
            if (isExistingCompany) {
              const product = await productModel.findOne({
                name: data?.product,
              });
              return {
                creator: new mongoose.Types.ObjectId(req.user.id),
                organization: req.user.organization,
                leadtype: "Company",
                status: data?.status,
                source: data?.source,
                followup_date:
                  data?.status === "Follow Up"
                    ? data?.followup_date
                    : undefined,
                followup_reason:
                  data?.status === "Follow Up"
                    ? data?.followup_reason
                    : undefined,
                company: isExistingCompany._id,
                products: product ? [product?._id] : null,
                remarks: data?.remarks,
                phone: data?.phone,
                email: data?.email,
                name: isExistingCompany?.companyname,
                productname: product?.name,
                leadCategory: data?.leadCategory,
              };
            }
          }
        } else {
          throw new Error("phone and product is a required field");
        }
      });

      // Wait for all promises to resolve or reject
      const customers = await Promise.all(customerPromise);

      // Filter out any undefined entries that may have resulted from unfulfilled promises
      const validCustomers = customers.filter(
        (customer) => customer !== undefined && customer.products !== null
      );

      const websiteCofiguration = await websiteConfigurationModel
        .findOne({
          organization: req.user.organization,
        })
        .populate("organization");
      const {
        sms_api_key,
        sms_api_secret,
        sms_sender_id,
        sms_welcome_template_id,
        sms_dealdone_template_id,
        sms_entity_id,
        email_id,
        email_password,
        organization,
      } = websiteCofiguration;

      for (customer of validCustomers) {
        // SEND SMS
        if (
          customer?.status === "New" &&
          sms_api_key &&
          sms_api_secret &&
          sms_sender_id &&
          sms_welcome_template_id &&
          sms_entity_id &&
          customer?.phone
        ) {
          const message = `Dear ${customer?.name}, Welcome to Itsybizz! We're thrilled to have you on board and ready to support your business journey. Let's succeed together!`;
          sendSms(
            sms_api_key,
            sms_api_secret,
            customer?.phone,
            sms_welcome_template_id,
            sms_sender_id,
            sms_entity_id,
            message
          );
        } else if (
          customer?.status === "Completed" &&
          sms_api_key &&
          sms_api_secret &&
          sms_sender_id &&
          sms_dealdone_template_id &&
          sms_entity_id &&
          customer?.phone
        ) {
          const message = `Hi ${customer?.name}, your purchase of ${customer?.productname} is confirmed! Thank you for choosing us. Feel free to reach out at +919205404075.-ITSYBIZZ`;
          sendSms(
            sms_api_key,
            sms_api_secret,
            customer?.phone,
            sms_dealdone_template_id,
            sms_sender_id,
            sms_entity_id,
            message
          );
        }

        // SEND EMAIL
        if (
          customer?.status === "New" &&
          email_id &&
          email_password &&
          customer?.email
        ) {
          const subject = ` Welcome to ${organization?.company}`;
          const message = `<p>Dear <strong>${customer?.name}</strong>,</p>
                        <br>
                        <p>Welcome to ${organization?.company}! We’re thrilled to have you on board and are excited to support you on your business journey</p>
                                        <br>
                                        <p>Our team is dedicated to helping you succeed, and we’re here to provide the resources and assistance you need every step of the way. If you have any questions or need guidance, please don’t hesitate to reach out.</p>
                                        <br>
                                        <p>Let’s succeed together!</p>
                                        <br>
                                        <p>Best regards,</p>
                                        <p>The ${organization?.company} Team</>`;

          sendBusinessEmail(
            customer?.email,
            subject,
            message,
            email_id,
            email_password
          );
        } else if (
          customer?.status === "Completed" &&
          email_id &&
          email_password &&
          customer?.email
        ) {
          const subject = `Your Purchase with ITSYBIZZ is Confirmed!`;
          const message = `<p>Dear <strong>${customer?.status}</strong>,</p>
      <br>
                       <p>Thank you for completing your purchase of ${customer?.productname}! We're thrilled to have you with us and are committed to providing you with the best experience.</p>
      <br>

                       <p>If you have any questions or need assistance, please don't hesitate to reach out at <strong>+91 92054 04075</strong> reply to this email.</p>
      <br>
                       <p>Thank you once again for choosing ${organization?.company}!</p>
      <br>

                       <p>Warm regards,</p>
                       <p>The ${organization?.company} Team</p>`;

          sendBusinessEmail(
            customer?.email,
            subject,
            message,
            email_id,
            email_password
          );
        }

        customer.phone = undefined;
        customer.email = undefined;
        customer.name = undefined;
        customer.productname = undefined;
      }

      // Create Bulk Leads
      await leadModel.insertMany(validCustomers);

      return res.status(400).json({
        status: 200,
        success: true,
        message: "Data uploaded successfully",
      });
    })
    .catch((error) => {
      // console.log(error);
      return res.status(400).json({
        status: 400,
        success: false,
        message: error?.message,
      });
    });

  // res.status(200).json({
  //   status: 200,
  //   success: true,
  //   message: "Data uploaded successfully",
  // });
};

const bulkDownload = TryCatch(async (req, res) => {
  const leads = await leadModel
    .find()
    .select("-_id -products -__v -assigned")
    .populate("organization", "company")
    .populate("creator", "name email phone")
    .populate("people", "firstname lastname email phone")
    .populate("company", "companyname email phone")
    .lean();

  let processedLeads = leads.map((lead) => {
    return {
      organization: lead.organization.company || "N/A",
      leadtype: lead.leadtype || "N/A",
      status: lead?.status || "N/A",
      source: lead?.source || "N/A",
      customer: lead?.people
        ? lead?.people?.firstname + " " + (lead?.people?.lastname || "")
        : "N/A",
      notes: lead?.notes || "N/A",
      location: lead?.location || "N/A",
      createdAt: new Date(lead?.createdAt).toLocaleDateString(),
      updatedAt: new Date(lead?.updatedAt).toLocaleDateString(),
      creator_name: lead?.creator?.name || "N/A",
      creator_email: lead?.creator?.email || "N/A",
      contact_person_email: lead?.people?.email || "N/A",
      contact_no: lead?.people?.phone || "N/A",
      company_name: lead?.company?.companyname || "N/A",
      company_email: lead?.company?.email || "N/A",
      company_phone: lead?.company?.phone || "N/A",
      lead_category: lead?.leadCategory || "N/A",
      followup_reason: lead?.followup_reason || "N/A",
      followup_date: lead.followup_date
        ? new Date(lead.followup_date).toLocaleDateString()
        : undefined,
    };
  });

  const csv = parse(processedLeads);

  // Set headers for CSV download
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",

    `attachment; filename="Leads-${Date.now()}.csv"`
  );
  res.status(200).send(csv);
});

const checkDataValidity = async (data) => {
  for (item of data) {
    // If the name or companyname is present, or if both are present
    if (
      (!item?.name && !item?.companyname) ||
      (!item?.name && !item?.companyname)
    ) {
      throw new Error("name/companyname anyone field is required!");
    }
    // If the status value is valid
    const validStatusValues = [
      "Draft",
      "New",
      "In Negotiation",
      "Completed",
      "Loose",
      "Cancelled",
      "Assigned",
      "On Hold",
      "Follow Up",
    ];
    if (item?.status) {
      let status = item?.status?.split(" ");
      item.status =
        capitalizeFirstChar(status[0]) +
        (status.length > 1 ? " " + capitalizeFirstChar(status[1]) : "");

      if (item?.status?.toLowerCase() === "assigned") {
        throw new Error(
          `Assigned status cannot be applied during bulk upload for record named ${
            item?.name || item?.companyname
          }`
        );
      }

      if (!validStatusValues.includes(item?.status)) {
        throw new Error(
          `Invalid status value found for record named ${
            item?.name || item?.companyname
          }: ${item?.status}`
        );
      }
    } else {
      throw new Error(
        `Status value is missing for record named ${
          item?.name || item?.companyname
        }`
      );
    }

    // Is the source valid
    const validSourceValues = [
      "Linkedin",
      "Social Media",
      "Website",
      "Advertising",
      "Friend",
      "Professionals Network",
      "Customer Referral",
      "Sales",
    ];
    if (item?.source) {
      let source = item?.source?.split(" ");
      item.source =
        capitalizeFirstChar(source[0]) +
        (source.length > 1 ? " " + capitalizeFirstChar(source[1]) : "");
      if (!validSourceValues.includes(item?.source)) {
        throw new Error(
          `Invalid source value found for record named ${
            item?.name || item?.companyname
          }: ${item?.source}`
        );
      }
    } else {
      throw new Error(
        `Source value is missing for record named ${
          item?.name || item?.companyname
        }`
      );
    }

    // Is the lead type is valid
    if (!item?.type) {
      throw new Error(
        `type is missing for record named ${item?.name || item?.companyname}`
      );
    } else if (
      item?.type &&
      item?.type?.toLowerCase() !== "individual" &&
      item?.type?.toLowerCase() !== "corporate"
    ) {
      throw new Error(
        `Invalid type value for record named ${
          item?.name || item?.companyname
        }: ${item?.type}`
      );
    }

    // If the status is followup then followup date and reason should be there
    if (item?.status?.toLowerCase() === "follow up") {
      if (!item?.followup_date || !item?.followup_reason) {
        throw new Error(
          `followup_date and followup_reason should be present if the status is Follow Up for record named ${
            item?.name || item?.companyname
          }`
        );
      } else if (!isValidDate(item?.followup_date)) {
        throw new Error(
          `followup_date is not valid for record named ${
            item?.name || item?.companyname
          }`
        );
      }
    }

    // If phone and email is not present and valid
    if (!item?.email) {
      throw new Error(
        `email value is missing for record named ${
          item?.name || item?.companyname
        }`
      );
    }
    if (!item?.phone) {
      throw new Error(
        `phone value is missing for record named ${
          item?.name || item?.companyname
        }`
      );
    } else if (item?.phone?.length > 10 || item?.phone?.length < 10) {
      throw new Error(
        `phone field should be 10 digits long for record named ${
          item?.name || item?.companyname
        }: ${item?.phone}`
      );
    }

    // If the product is present and valid
    const products = await productModel.find();
    const productsName = products.map((product) => product.name);
    if (!item?.product) {
      throw new Error(
        `product value missing for record named ${
          item?.name || item?.companyname
        }`
      );
    } else {
      if (!productsName?.includes(item?.product)) {
        throw new Error(
          `Invalid product name found for record named ${
            item?.name || item?.companyname
          }`
        );
      }
    }
  }
};

function isValidDate(date) {
  const parsedDate = new Date(date);

  // Check if the parsed date is valid
  return !isNaN(parsedDate.getTime());
}

// lead move to data bank
const dataBank = async (req, res) => {
  const { dataInfo, dataBank } = req.body;

  await leadModel.updateMany({ _id: { $in: dataInfo } }, { dataBank });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Data uploaded successfully",
  });
};

const scheduleDemo = TryCatch(async (req, res) => {
  const { leadId, demoDateTime, demoType, notes } = req.body;

  const lead = await leadModel.findById(leadId);
  if (!lead) {
    throw new ErrorHandler("Lead not found", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    lead.creator.toString() !== req.user.id.toString() &&
    lead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new ErrorHandler(
      "You don't have permission to schedule demo for this lead",
      403
    );
  }

  const updatedLead = await leadModel.findByIdAndUpdate(
    leadId,
    {
      demo: {
        demoDateTime: new Date(demoDateTime),
        demoType,
        notes: notes || "",
      },
      status: "Scheduled Demo",
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: "Demo scheduled successfully",
    lead: updatedLead,
  });
});

const completeDemo = TryCatch(async (req, res) => {
  const { leadId } = req.body;
  const riFile = req.file;

  if (!riFile) {
    throw new ErrorHandler("RI file is required", 400);
  }

  const lead = await leadModel.findById(leadId);
  if (!lead) {
    throw new ErrorHandler("Lead not found", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    lead.creator.toString() !== req.user.id.toString() &&
    lead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new ErrorHandler(
      "You don't have permission to complete this demo",
      403
    );
  }

  const updatedLead = await leadModel.findByIdAndUpdate(
    leadId,
    {
      status: "Completed",
      riFile: riFile.path,
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: "Demo completed successfully",
    lead: updatedLead,
  });
});

module.exports = {
  createLead,
  editLead,
  deleteLead,
  deleteAllLead,
  allLeads,
  leadDetails,
  assignedLeads,
  leadSummary,
  bulkUpload,
  bulkAssign,
  bulkDownload,
  dataBank,
  scheduleDemo,
  completeDemo
};
