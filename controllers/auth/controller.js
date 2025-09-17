const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { TryCatch, ErrorHandler } = require("../../helpers/error");
const { sendEmail } = require("../../helpers/sendEmail");
const adminModel = require("../../models/admin");
const otpModel = require("../../models/otp");
const websiteConfigurationModel = require("../../models/websiteConfiguration");
const organizationModel = require("../../models/organization");
const accountModel = require("../../models/account");
const getDateDifference = require("../../helpers/getDateDifference");

const register = TryCatch(async (req, res) => {
  const { name, email, phone, password, designation, organizationEmail } =
    req.body;

  const isExistingOrganization = await organizationModel
    .findOne({
      email: organizationEmail,
    })
    .populate("account");
  if (!isExistingOrganization) {
    throw new Error("Company not found", 404);
  }
  if (isExistingOrganization?.account?.account_type === "trial") {
    throw new Error(
      "In trial account, you cannot create an employee account",
      400
    );
  }
  if (isExistingOrganization?.account?.account_type === "subscription") {
    const totalEmployees = await organizationModel.find({
      organization: isExistingOrganization._id,
    }).countDocuments();
    const totalAllowedAccounts = isExistingOrganization.employeeCount;

    if (totalEmployees >= totalAllowedAccounts + 1) {
      throw new Error(
        "You have reached the max limit of employee accounts",
        400
      );
    }
  }

  const isExistingUserWithEmail = await adminModel.findOne({ email });
  if (isExistingUserWithEmail) {
    throw new ErrorHandler("A user with this email id already exists", 409);
  }

  const isExistingUserWithPhone = await adminModel.findOne({ phone });
  if (isExistingUserWithPhone) {
    throw new ErrorHandler("A user with this phone no. already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // const isFirstAdmin = await adminModel.find().countDocuments();

  // let user;
  // if (isFirstAdmin > 0) {
  //   user = await adminModel.create({
  //     organization: isExistingOrganization._id,
  //     name,
  //     email,
  //     phone,
  //     designation,
  //     password: hashedPassword,
  //   });
  // } else {
  //   user = await adminModel.create({
  //     organization: isExistingOrganization._id,
  //     name,
  //     email,
  //     phone,
  //     designation,
  //     password: hashedPassword,
  //     role: "Super Admin",
  //     allowedroutes: [
  //       "admin",
  //       "dashboard",
  //       "people",
  //       "company",
  //       "lead",
  //       "product",
  //       "category",
  //       "expense",
  //       "expense-category",
  //       "offer",
  //       "proforma-invoice",
  //       "invoice",
  //       "payment",
  //       "customer",
  //       "report",
  //       "support",
  //       "website configuration",
  //     ],
  //   });

  // //   await websiteConfigurationModel.create({
  // //     creator: user._id,
  // //     indiamart_api: "",
  // //     facebook_api: "",
  // //   });
  // }

  const user = await adminModel.create({
    organization: isExistingOrganization._id,
    name,
    email,
    phone,
    designation,
    password: hashedPassword,
    profileimage: req.file.filename,
  });

  const otp = generateOTP();
  await otpModel.create({
    email,
    otp,
  });

  await sendEmail(
    email,
    "OTP Verification",
    `
    <div>Hi ${name}</div>
    <br>
    <div>${otp} is your OTP(One-Time-Password) to verify your account. OTP is valid for 5 minutes. Do not share your OTP with anyone.</div>
    <br>
    <div>Best Regards</div>
    <div>Deepnap Softech</div>
    `
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OTP has been sent to your email id",
    // user: {
    //   id: user._id,
    //   name: user.name,
    //   email: user.email,
    //   role: user.role,
    //   allowedroutes: user.allowedroutes,
    // },
  });
});

const verifyOTPAfterRegister = TryCatch(async (req, res) => {
  const { email, otp } = req.body;

  const isOTPValid = await otpModel.findOne({ email, otp });
  if (!isOTPValid) {
    throw new Error("Invalid OTP");
  }

  await otpModel.deleteOne({ email, otp });
  await adminModel.findOneAndUpdate({ email: email }, { verified: true });

  const user = await adminModel.findOne({ email });

  await sendEmail(
    email,
    "Registeration Successful",
    `
    <div>Hi ${user.name},</div>
    <br>
    <div>Congratulations and welcome!</div>
    <br>
    <div>We’re thrilled to let you know that your registration has been successfully completed.</div>
    <br>
    <div>Best Regards</div>
    <div>Deepnap Softech</div>
    `
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OTP verified successfully",
  });
});

const login = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await adminModel
    .findOne({ email })
    .select("password email name role allowedroutes")
    .populate({
      path: "organization",
      populate: {
        path: "account",
      },
    });

  if (!existingUser) {
    throw new ErrorHandler("User not found", 404);
  }

  const passwordMatched = await bcrypt.compare(password, existingUser.password);

  if (!passwordMatched) {
    throw new Error("Make sure you have entered the correct credentials", 401);
  }

  const isVerified = await adminModel.findOne({ email }).select("verified");
  if (!isVerified.verified) {
    const otpExists = await otpModel.findOne({ email });
    if (!otpExists) {
      const otp = generateOTP();
      await otpModel.create({
        email,
        otp,
      });
    }

    return res.status(401).json({
      status: 401,
      success: false,
      verified: false,
      message: "Account not verified.",
    });
  }

  const access_token = jwt.sign(
    {
      _id: existingUser._id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role,
      allowedroutes: existingUser.allowedroutes,
      iat: Math.floor(Date.now() / 1000) - 30,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const organization = await organizationModel
    .findById(existingUser?.organization)
    .populate("account");

    // console.log(existingUser.allowedroutes)
  let allowedroutes;
  if (
    organization?.account?.account_type === "trial" &&
    organization?.account?.trial_started  && (getDateDifference(new Date(), organization?.account?.trial_start) <= 7)
  ) {
    allowedroutes = ["dashboard", "people", "company", "lead"];
  } else if (
    organization?.account?.account_type === "subscription" &&
    organization?.account?.account_status === "active"
  ) {
    allowedroutes = existingUser.allowedroutes;
  } else {
    allowedroutes = [];
  }

  res.status(200).json({
    status: 200,
    success: true,
    access_token: access_token,
    message: "User logged in successfully",
    verified: true,
    user: {
      id: existingUser._id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      allowedroutes,
      isTrial:
        organization?.account?.account_type === "trial" &&
        organization?.account?.trial_started,
      isTrialEnded:
        getDateDifference(organization?.account?.trial_start, new Date()) > 7,
      isSubscribed: organization?.account?.account_type === "subscription",
      isSubscriptionEnded: (
        organization?.account?.account_type === "subscription" &&
        !organization?.account?.subscription
      ),
      account: existingUser?.organization?.account,
    },
  });
});

const loginWithAccessToken = TryCatch(async (req, res, next) => {
  const access_token = req.headers.authorization.split(" ")[1];

  const verified = jwt.verify(access_token, process.env.JWT_SECRET);
  const currTimeInSeconds = Math.floor(Date.now() / 1000);

  // access_token is not expired
  if (
    verified &&
    verified.iat < currTimeInSeconds &&
    verified.exp > currTimeInSeconds
  ) {
    const user = await adminModel.findById(verified._id).populate({
      path: "organization",
      populate: {
        path: "account",
      },
    });

    if (!user) {
      throw new Error("User doesn't exists");
    }

    const organization = await organizationModel
      .findById(user?.organization)
      .populate("account");

    let allowedroutes;
    if (
      organization?.account?.account_type === "trial" &&
      organization?.account?.trial_started && (getDateDifference(new Date, organization?.account?.trial_start) <= 7)
    ) {
      allowedroutes = ["dashboard", "people", "company", "lead"];
    } else if (
      (organization?.account?.account_type === "subscription" &&
        organization?.account?.account_status === "active")
    ) {
      allowedroutes = user.allowedroutes;
    } else {
      allowedroutes = [];
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "User has been logged in successfully",
      user: {
        id: verified._id,
        email: verified.email,
        name: verified.name,
        role: verified.role,
        allowedroutes,
        isTrial:
          organization?.account?.account_type === "trial" &&
          organization?.account?.trial_started,
        isTrialEnded:
          getDateDifference(organization?.account?.trial_start, new Date()) > 7,
        isSubscribed: organization?.account?.account_type === "subscription",
        isSubscriptionEnded: (
          organization?.account?.account_type === "subscription" &&
          !organization?.account?.subscription
        ),
        account: user?.organization?.account,
      },
    });
  } else {
    throw new Error("Session expired!");
  }
});

const isAuthenticated = TryCatch(async (req, res, next) => {
  let access_token = req.headers?.authorization?.split(" ")[1];

  try {
    const verified = jwt.verify(access_token, process.env.JWT_SECRET);
    const currTimeInMilliSeconds = Math.floor(Date.now() / 1000);

    // access_token is not expired
    if (
      verified &&
      verified.iat < currTimeInMilliSeconds &&
      verified.exp > currTimeInMilliSeconds
    ) {
      const user = await adminModel.findById(verified._id);
      if (!user) {
        throw new Error("User doesn't exists");
      }

      const account = await accountModel.findOne({
        organization: user.organization,
      });

      let isTrialEnded = false;
      if (account?.trial_started) {
        const gap = new Date() - new Date(account?.trial_start);
        const days = Math.ceil(gap / (1000 * 3600 * 24));
        isTrialEnded = days > 7;
      }

      req.user = {
        id: verified._id,
        email: verified.email,
        name: verified.name,
        role: verified.role,
        allowedroutes: user.allowedroutes,
        organization: user.organization,
        account_type: account?.account_type,
        is_trial: account?.trial_started,
        trial_ended: isTrialEnded,
      };
     
      next();
    } else {
      throw new Error("Session expired!");
    }
  } catch (err) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: err.message,
    });
  }
});

const isExists = TryCatch(async (req, res, next)=>{
  
})

const generateOTP = () => {
  let digits = "0123456789";
  let OTP = "";
  let len = digits.length;
  for (let i = 0; i < 4; i++) {
    OTP += digits[Math.floor(Math.random() * len)];
  }

  return OTP;
};

const getOTP = TryCatch(async (req, res) => {
  const { email } = req.body;

  const user = await adminModel.findOne({ email: email });
  if (!user) {
    throw new Error("User doesn't exists", 404);
  }
  const isExistingOtp = await otpModel.findOne({ email: email });

  if (isExistingOtp) {
    await sendEmail(
      email,
      "OTP Verification",
      `
    <div>Hi ${user.name},</div>
    <br>
    <div>${isExistingOtp.otp} is your OTP(One-Time-Password) to verify your account. OTP is valid for 5 minutes. Do not share your OTP with anyone.</div>
    <br>    
    <div>Best Regards</div>
    <div>Deepnap Softech</div>
    `
    );

    return res.status(200).json({
      status: 200,
      success: true,
      message: "OTP has been sent to your email id",
    });
  }

  const otp = generateOTP();

  await otpModel.create({
    email: user.email,
    otp,
  });

  await sendEmail(
    email,
    "OTP Verification",
    `
    <div>Hi ${user.name},</div>
    <br>
    <div>${otp} is your OTP(One-Time-Password) to verify your account. OTP is valid for 5 minutes. Do not share your OTP with anyone.</div>
    <br>    
    <div>Best Regards</div>
    <div>Deepnap Softech</div>
    `
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OTP has been sent to your email id",
  });
});

const verifyOTP = TryCatch(async (req, res) => {
  const { email, otp } = req.body;

  const user = await adminModel.findOne({ email: email });
  if (!user) {
    throw new Error("User doesn't exists", 404);
  }

  const isOTPValid = await otpModel.findOne({ email: email, otp: otp });
  if (!isOTPValid) {
    throw new Error("Invalid OTP");
  }

  await otpModel.deleteOne({ email: email });

  const resetToken = jwt.sign(
    {
      email: email,
    },
    process.env.PASSWORD_RESET_SECRET,
    {
      expiresIn: "1m",
    }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OTP verified successfully",
    resetToken,
  });
});

const resetPassword = TryCatch(async (req, res) => {
  const { resetToken, email, newPassword } = req.body;

  try {
    const verified = jwt.verify(resetToken, process.env.PASSWORD_RESET_SECRET);
    const currTimeInMilliSeconds = Math.floor(Date.now() / 1000);

    if (
      verified &&
      verified.iat < currTimeInMilliSeconds &&
      verified.exp > currTimeInMilliSeconds &&
      verified.email === email
    ) {
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await adminModel.findOneAndUpdate(
        { email },
        { password: hashedPassword, verified: true }
      );

      return res.status(200).json({
        status: 200,
        success: true,
        message: "Your password has been reset successfully",
      });
    }

    throw new Error("Invalid token");
  } catch (err) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "Something went wrong",
    });
  }
});

module.exports = {
  register,
  login,
  isAuthenticated,
  loginWithAccessToken,
  getOTP,
  verifyOTP,
  resetPassword,
  verifyOTPAfterRegister,
};
