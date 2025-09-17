const accountModel = require("../models/account");
const { TryCatch } = require("./error");

const checkAccess = TryCatch(async (req, res, next) => {
  const route = req.originalUrl.split("/")[2];
  // const account = await accountModel.findOne({
  //   organization: req.user.organization,
  // });

  const trial_routes = ["dashboard", "people", "company", "lead"];

  if (req.user?.account_type === "trial" && trial_routes.includes(route)) {
    next();
  } else if (
    (req.user?.account_type === "subscription" || req.user?.account_type === "fulltime") &&
    (req.user.role === "Super Admin" || req.user.allowedroutes.includes(route))
  ) {
    next();
  } else {
    res.status(401).json({
      status: 401,
      success: false,
      message: `You don't have access to ${route} route.`,
    });
  }
});

module.exports = { checkAccess };
