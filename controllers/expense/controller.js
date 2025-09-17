const { TryCatch, ErrorHandler } = require("../../helpers/error");

const expenseCategoryModel = require("../../models/expenseCategory");
const expenseModel = require("../../models/expense");

const createExpense = TryCatch(async (req, res) => {
  const { name, categoryId, price, description, ref } = req.body;

  const isCategoryExists = await expenseCategoryModel.findById(categoryId);
  if (!isCategoryExists) {
    throw new ErrorHandler("Category doesn't exists", 400);
  }

  const expense = await expenseModel.create({
    name,
    category: categoryId,
    description,
    price,
    ref,
    creator: req.user.id,
    organization: req.user.organization
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Expense has been added successfully",
    expense: expense,
  });
});

const editExpense = TryCatch(async (req, res) => {
  const { expenseId, name, categoryId, price, description, ref } = req.body;

  const isExpenseExists = await expenseModel.findById(expenseId);
  if (!isExpenseExists) {
    throw new ErrorHandler("Expense doesn't exists", 400);
  }

  const isCategoryExists = await expenseCategoryModel.findById(categoryId);
  if (!isCategoryExists) {
    throw new ErrorHandler("Category doesn't exists", 400);
  }

  const updatedExpense = await expenseModel.findOneAndUpdate(
    { _id: expenseId },
    {
      name,
      category: categoryId,
      description,
      price,
      ref,
    },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Expense has been updated successfully",
    updatedExpense: updatedExpense,
  });
});

const deleteExpense = TryCatch(async (req, res) => {
  const { expenseId } = req.body;

  const isExpenseExists = await expenseModel.findById(expenseId);

  if (!isExpenseExists) {
    throw new ErrorHandler("Expense doesn't exists", 400);
  }
  if (req.user.role !== "Super Admin") {
    throw new Error("You are not allowed to delete this expense", 401);
  }

  await expenseModel.deleteOne({ _id: expenseId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Expense has been deleted successfully",
  });
});

const expenseDetails = TryCatch(async (req, res) => {
  const { expenseId } = req.body;

  const expense = await expenseModel
    .findById(expenseId)
    .populate("category", "categoryname");
  if (!expense) {
    throw new ErrorHandler("Expense doesn't exists", 400);
  }

  res.status(200).json({
    status: 200,
    success: true,
    expense: expense,
  });
});

const allExpenses = TryCatch(async (req, res) => {
  const { page = 1 } = req.body;

  // const totalExpensesPerPage = 10;
  // const skip = (page-1)*totalExpensesPerPage;

  const expenses = await expenseModel
    .find({organization: req.user.organization})
    .sort({ createdAt: -1 })
    // .skip(skip)
    // .limit(totalExpensesPerPage)
    .populate([
      { path: "category", populate: "categoryname", strictPopulate: false },
    ]).populate('creator', 'name');

  const results = expenses.map((e) => {
    return {
      _id: e._id,
      name: e.name,
      category: e.category.categoryname,
      description: e.description,
      price: e.price,
      ref: e.ref,
      creator: e?.creator?.name,
      createdAt: e?.createdAt
    };
  });

  res.status(200).json({
    status: 200,
    success: true,
    expenses: results,
  });
});

module.exports = {
  createExpense,
  editExpense,
  deleteExpense,
  allExpenses,
  expenseDetails,
};
