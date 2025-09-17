const crypto = require("crypto");
const { TryCatch } = require("../../helpers/error");
const accountModel = require("../../models/account");
const organizationModel = require("../../models/organization");
const subscriptionModel = require("../../models/subscription");
const instance = require("../../utils/razorpay");
const paymentModel = require("../../models/payment");
const subscriptionPaymentModel = require("../../models/subscriptionPayment");

const getRazorpayKey = TryCatch(async (req, res) => {
  const razorpay_key_id = process.env.RZP_KEY_ID;

  if (!razorpay_key_id) {
    throw new Error("RZP_KEY_ID not found", 404);
  }

  res.status(200).json({
    status: 200,
    success: true,
    razorpay_key_id,
  });
});

const createSubscription = TryCatch(async (req, res) => {
  const { quantity } = req.body;
  const organization = await organizationModel.findById(req.organization.id);

  if (!organization) {
    throw new Error("Organization doesn't exist", 404);
  }

  const account = await accountModel.findOne({
    organization: organization._id,
  });
  const isExistingSubscription = await subscriptionModel.findById(
    account?.subscription
  );
  if (isExistingSubscription) {
    return res.status(200).json({
      status: 200,
      success: true,
      subscription_id: isExistingSubscription.razorpaySubscriptionId,
    });
  }

  const plan_id = process.env.RZP_SUBSCRIPTION_PLAN_ID;
  if (!plan_id) {
    throw new Error("Plan id not found", 404);
  }

  const subscription = await instance.subscriptions.create({
    plan_id,
    customer_notify: 1,
    total_count: 240,
    quantity
  });

  // console.log(subscription);

  const createdSubscription = await subscriptionModel.create({
    razorpaySubscriptionId: subscription.id,
    startDate: subscription.start_at,
    endDate: subscription.end_at,
    status: subscription.status,
    // payment_status: "pending",
  });

  account.subscription = createdSubscription._id;
  account.account_type = "subscription";
  account.account_name = "Monthly Plan";
  await account.save();

  res.status(200).json({
    status: 200,
    success: true,
    subscription_id: subscription.id,
  });
});

const paymentVerfication = TryCatch(async (req, res) => {
  const { razorpay_payment_id, razorpay_signature } = req.body;

  const account = await accountModel.findOne({
    organization: req?.organization?.id,
  });
  if (!account) {
    throw new Error("Account not found", 404);
  }
  const subscription = await subscriptionModel.findById(account?.subscription);
  if (!subscription) {
    throw new Error("Subscription not found", 404);
  }

  const subscription_id = subscription.razorpaySubscriptionId;
  //   const subscription_id = "sub_P6u63fA26YKNql";
  const generated_signature = crypto
    .createHmac("sha256", process.env.RZP_KEY_SECRET)
    .update(razorpay_payment_id + "|" + subscription_id, "utf-8")
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;
  if (!isAuthentic) {
    throw new Error("Payment failed", 400);
  }

  //   subscription.amount =
  // subscription.payment_status = "success";
  // subscription.payment_status = "success";
  subscription.razorpayPaymentId = razorpay_payment_id;
  await subscription.save();

  await accountModel.findOneAndUpdate(
    {
      subscription: subscription._id,
    },
    {
      account_status: "active",
    }
  );

  // Redirect TODO to payment success page in frontend
  //   return res.redirect("http://localhost:3000/payment-success");
  res.status(200).json({
    status: 200,
    success: true,
    razorpay_payment_id,
    message: "Payment successful",
    razorpay_payment_id,
  });
});

const cancelSubscription = TryCatch(async (req, res) => {
  const account = await accountModel.findOne({
    organization: req.organization.id,
  });
  if (!account) {
    throw new Error("Account not found", 404);
  }
  const subscription = await subscriptionModel.findById(account?.subscription);
  if (!subscription) {
    throw new Error("Subscription not found", 404);
  }

  await instance.subscriptions.cancel(subscription.razorpaySubscriptionId);
  await subscription.deleteOne();
  account.subscription = undefined;
  account.account_status = "inactive";
  account.account_name = "Trial Plan";
  account.account_type = "trial";
  await account.save();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Your subscription has been cancelled successfully",
  });
});

const webhookHandler = async (req, res) => {
  const event = req.body.event;
  const payload = req.body.payload;

  // subscription.cancelled;
  // payment.authorized;
  // payment.captured;
  // subscription.authenticated;
  // subscription.activated;
  // subscription.charged;

  // console.log(event);

  if (event === "payment.captured" || event === "payment.failed") {
    const razorpayPaymentId = payload.payment.entity.id;
    const customerEmail = payload.payment.entity.email;

    const customer = await organizationModel.findOne({ email: customerEmail });
    if (!customer) {
      return res.status(400).json({});
    }
    const customerAccount = await accountModel.findOne({
      organization: customer._id,
    });
    if (!customerAccount) {
      return res.status(400).json({});
    }
    const subscription = await subscriptionModel.findById(
      customerAccount.subscription
    );
    if (!subscription) {
      return res.status(400).json({});
    }

    subscription.status = payload.payment.entity.status;
    await subscription.save();

    const payment = await subscriptionPaymentModel.create({
      subscription: subscription._id,
      razaorpayPaymentId: payload.payment.entity.id,
      amount: payload.payment.entity.amount / 100,
      status: payload.payment.entity.status,
      captured: payload.payment.entity.captured,
      orderId: payload.payment.entity.order_id,
      invoiceId: payload.payment.entity.invoice_id,
      method: payload.payment.entity.method,
      email: payload.payment.entity.email,
      fee: payload.payment.entity.fee / 100,
      tax: payload.payment.entity.tax / 100,
      error_code: payload.payment.entity.error_code,
      error_description: payload.payment.entity.error_description,
      razorpayCreatedAt: payload.payment.entity.created_at,
    });
  } else if (
    event === "subscription.activated" ||
    event === "subscription.paused" ||
    event === "subscription.resumed" ||
    event === "subscription.activated" ||
    event === "subscription.pending" ||
    event === "subscription.halted" ||
    event === "subscription.cancelled"
  ) {
    const subscriptionId = payload.subscription.entity.id;

    const subscription = await subscriptionModel.findOne({
      razorpaySubscriptionId: subscriptionId,
    });
    if (!subscription) {
      return res.status(200).json({});
    }

    if (event === "subscription.halted") {
      await accountModel.findOneAndUpdate(
        {
          subscription: subscription._id,
        },
        {
          $unset: { subscription: "" },
          $set: { account_status: "inactive" },
        }
      );
      await subscription.deleteOne();
    } else if (event === "subscription.activated") {
      await accountModel.findOneAndUpdate(
        {
          subscription: subscription._id,
        },
        {
          $set: { account_status: "active" },
        }
      );
      await subscription.deleteOne();
    } else {
      subscription.status = payload.subscription.entity.status;
      await subscription.save();
    }
  }

  res.status(200).json({});
};

const planDetails = TryCatch(async (req, res) => {
  const { plan_id } = req.body;

  const plan = await instance.plans.fetch(plan_id);

  res.status(200).json({
    success: true,
    status: 200,
    plan,
  });
});

module.exports = {
  getRazorpayKey,
  createSubscription,
  paymentVerfication,
  cancelSubscription,
  webhookHandler,
  planDetails,
};
