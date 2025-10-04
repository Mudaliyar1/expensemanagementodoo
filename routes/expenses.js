const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuthenticated, ensureEmployee } = require('../middleware/auth');

// Delete individual expense (employee)
router.post('/delete/:id', ensureAuthenticated, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, submittedBy: req.user._id });
    if (!expense) {
      req.flash('error_msg', 'Expense not found or not authorized');
      return res.redirect('/expenses/dashboard');
    }
    await Expense.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Expense deleted successfully');
    res.redirect('/expenses/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting expense');
    res.redirect('/expenses/dashboard');
  }
});

// Bulk delete expenses (employee)
router.post('/bulk-delete', ensureAuthenticated, async (req, res) => {
  try {
    const ids = req.body.expenseIds || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      req.flash('error_msg', 'No expenses selected for deletion');
      return res.redirect('/expenses/dashboard');
    }
    await Expense.deleteMany({ _id: { $in: ids }, submittedBy: req.user._id });
    req.flash('success_msg', 'Selected expenses deleted successfully');
    res.redirect('/expenses/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting expenses');
    res.redirect('/expenses/dashboard');
  }
});
const Expense = require('../models/Expense');
const User = require('../models/User');
const Company = require('../models/Company');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const currencyConverter = require('currency-converter-lt');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and PDFs only
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('File type not supported'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Employee Dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const expenses = await Expense.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 });
    
    res.render('expenses/dashboard', {
      expenses,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving expenses');
    res.redirect('/');
  }
});

// New Expense Form
router.get('/new', ensureAuthenticated, ensureEmployee, async (req, res) => {
  try {
    const company = await Company.findById(req.user.company);
    const workflows = await ApprovalWorkflow.find({ company: req.user.company, isActive: true });
    
    res.render('expenses/new', {
      company,
      workflows,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/expenses/dashboard');
  }
});

// Submit New Expense
router.post('/new', ensureAuthenticated, ensureEmployee, upload.single('receipt'), async (req, res) => {
  try {
    // Extra defensive guard: ensure only Employees can create expenses
    if (!req.user || req.user.role !== 'Employee') {
      req.flash('error_msg', 'Only employees can submit expenses');
      return res.redirect('/dashboard');
    }
    const { amount, currency, category, description, date, workflowId } = req.body;
    
    // Validate date is not in the future
    if (new Date(date) > new Date()) {
      req.flash('error_msg', 'Expense date cannot be in the future');
      return res.redirect('/expenses/new');
    }
    
    // Get company default currency
    const company = await Company.findById(req.user.company);
    
    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      req.flash('error_msg', 'Invalid amount');
      return res.redirect('/expenses/new');
    }

    // Convert currency using real-time rates
    let convertedAmount = amountNum;
    if (currency !== company.defaultCurrency) {
      try {
        const currencyConverter = require('../utils/currencyConverter');
        convertedAmount = await currencyConverter.convert(amountNum, currency, company.defaultCurrency);
      } catch (convErr) {
        console.error('Currency conversion failed:', convErr);
        convertedAmount = amountNum;
      }
    }
// Withdraw Expense (Employee)
router.post('/:id/withdraw', ensureAuthenticated, ensureEmployee, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      req.flash('error_msg', 'Expense not found');
      return res.redirect('/expenses/dashboard');
    }
    // Only allow withdrawal if status is Pending and submitted by current user
    if (expense.status !== 'Pending' || expense.submittedBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'You can only withdraw your own pending expenses');
      return res.redirect('/expenses/dashboard');
    }
    await Expense.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Expense withdrawn successfully');
    res.redirect('/expenses/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error withdrawing expense');
    res.redirect('/expenses/dashboard');
  }
});
    
    // Create new expense
    const newExpense = new Expense({
      amount: parseFloat(amount),
      currency,
      convertedAmount,
      category,
      description,
      date,
      receipt: req.file ? `/uploads/${req.file.filename}` : null,
      submittedBy: req.user._id,
      company: req.user.company,
      workflow: workflowId
    });
    
    // Initialize approval history
    const workflow = await ApprovalWorkflow.findById(workflowId);
    
    // If workflow includes manager approval and user has a manager
    if (workflow.includeManagerApproval && req.user.manager) {
      newExpense.approvalHistory.push({
        step: 0, // Manager approval is step 0
        approver: req.user.manager,
        decision: 'Pending',
        comment: ''
      });
      newExpense.currentApprovalStep = 0;
    } else {
      newExpense.currentApprovalStep = 1;
    }

    // Add all approvers for all workflow steps to approvalHistory
    if (workflow.steps && workflow.steps.length > 0) {
      workflow.steps.forEach((step, idx) => {
        const stepNum = step.stepNumber || (idx + 1);
        step.approvers.forEach(approver => {
          newExpense.approvalHistory.push({
            step: stepNum,
            approver,
            decision: 'Pending',
            comment: ''
          });
        });
      });
    }
    
    await newExpense.save();
    
    req.flash('success_msg', 'Expense submitted successfully');
    res.redirect('/expenses/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error submitting expense');
    res.redirect('/expenses/new');
  }
});

// View Expense Details
router.get('/view/:id', ensureAuthenticated, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('submittedBy')
      .populate('approvalHistory.approver')
      .populate('workflow');
    
    if (!expense) {
      req.flash('error_msg', 'Expense not found');
      return res.redirect('/expenses/dashboard');
    }
    
    // Strict permission check:
    // - Employees can only view their own expenses
    // - Managers can view their team's expenses and their own
    // - Admins can view all expenses
    if (req.user.role === 'Employee' && expense.submittedBy._id.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'You do not have permission to view this expense');
      return res.redirect('/expenses/dashboard');
    }
    
    // For managers, check if the expense belongs to their team member
    if (req.user.role === 'Manager' && 
        expense.submittedBy._id.toString() !== req.user._id.toString()) {
      // Get team members
      const teamMembers = await User.find({ manager: req.user._id });
      const teamMemberIds = teamMembers.map(member => member._id.toString());
      
      // Check if expense submitter is in the team
      if (!teamMemberIds.includes(expense.submittedBy._id.toString())) {
        req.flash('error_msg', 'You do not have permission to view this expense');
        return res.redirect('/approvals/dashboard');
      }
    }
    // Get company info for currency display
    const company = await Company.findById(expense.company);

    // Determine if current user is an approver for any pending approval on this expense
    const isCurrentApprover = expense.approvalHistory && expense.approvalHistory.some(appr => {
      // appr.approver may be populated (object) or an ObjectId
      const approverId = appr.approver && appr.approver._id ? appr.approver._id.toString() : (appr.approver ? appr.approver.toString() : null);
      return approverId === req.user._id.toString() && appr.decision === 'Pending';
    });

    res.render('expenses/view', {
      expense,
      user: req.user,
      company,
      isCurrentApprover
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving expense details');
    res.redirect('/expenses/dashboard');
  }
});

module.exports = router;