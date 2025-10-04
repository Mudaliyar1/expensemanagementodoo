
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Company = require('../models/Company');
const Expense = require('../models/Expense');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');

// Bulk delete expenses
router.post('/expenses/bulk-delete', ensureAdmin, async (req, res) => {
  try {
    const ids = req.body.expenseIds || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      req.flash('error_msg', 'No expenses selected for deletion');
      return res.redirect('/admin/expenses');
    }
    await Expense.deleteMany({ _id: { $in: ids } });
    req.flash('success_msg', 'Selected expenses deleted successfully');
    res.redirect('/admin/expenses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting expenses');
    res.redirect('/admin/expenses');
  }
});

// Delete individual expense
router.post('/expenses/delete/:id', ensureAdmin, async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Expense deleted successfully');
    res.redirect('/admin/expenses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting expense');
    res.redirect('/admin/expenses');
  }
});

// Helper: safely parse steps object from form data into workflow steps
function parseWorkflowSteps(steps) {
  const parsedSteps = [];
  if (!steps) return parsedSteps;
  // If steps are provided as an indexed object (steps['0'] = {...}) handle that
  const keys = Object.keys(steps);
  const indexedKeys = keys.filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
  if (indexedKeys.length > 0) {
    indexedKeys.forEach((k, idx) => {
      const s = steps[k] || {};
      let stepNumber = parseInt(s.stepNumber);
      if (isNaN(stepNumber)) stepNumber = idx + 1;

      let requiredApprovalPercentage = parseInt(s.requiredApprovalPercentage);
      if (isNaN(requiredApprovalPercentage)) requiredApprovalPercentage = 100;

      let approversArr = [];
      if (s.approvers === undefined || s.approvers === null) {
        approversArr = [];
      } else if (Array.isArray(s.approvers)) {
        approversArr = s.approvers.filter(a => a && a !== 'undefined');
      } else {
        approversArr = [s.approvers].filter(a => a && a !== 'undefined');
      }

      let specificApproverOverride = s.specificApproverOverride === '' ? null : s.specificApproverOverride || null;

      parsedSteps.push({
        stepNumber,
        approvers: approversArr,
        requiredApprovalPercentage,
        specificApproverOverride
      });
    });

    return parsedSteps;
  }

  // Fallback: legacy flat structure where fields are arrays or single values
  let stepCount = 1;
  if (Array.isArray(steps.stepNumber)) stepCount = steps.stepNumber.length;
  else if (Array.isArray(steps.approvers)) stepCount = steps.approvers.length;
  else if (Array.isArray(steps.requiredApprovalPercentage)) stepCount = steps.requiredApprovalPercentage.length;

  for (let i = 0; i < stepCount; i++) {
    // Pull values (could be array or single value)
    let stepNumber = Array.isArray(steps.stepNumber) ? steps.stepNumber[i] : steps.stepNumber;
    let approvers = Array.isArray(steps.approvers) ? steps.approvers[i] : steps.approvers;
    let requiredApprovalPercentage = Array.isArray(steps.requiredApprovalPercentage)
      ? steps.requiredApprovalPercentage[i]
      : steps.requiredApprovalPercentage;
    let specificApproverOverride = Array.isArray(steps.specificApproverOverride)
      ? steps.specificApproverOverride[i]
      : steps.specificApproverOverride;

    // Coerce and default numeric values
    stepNumber = parseInt(stepNumber);
    if (isNaN(stepNumber)) stepNumber = i + 1;

    requiredApprovalPercentage = parseInt(requiredApprovalPercentage);
    if (isNaN(requiredApprovalPercentage)) requiredApprovalPercentage = 100;

    // Normalize approvers into a cleaned array (remove empty/undefined)
    let approversArr = [];
    if (approvers === undefined || approvers === null) {
      approversArr = [];
    } else if (Array.isArray(approvers)) {
      approversArr = approvers.filter(a => a && a !== 'undefined');
    } else {
      approversArr = [approvers].filter(a => a && a !== 'undefined');
    }

    if (specificApproverOverride === '') specificApproverOverride = null;

    parsedSteps.push({
      stepNumber,
      approvers: approversArr,
      requiredApprovalPercentage,
      specificApproverOverride: specificApproverOverride || null
    });
  }

  return parsedSteps;
}

// Admin Dashboard
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    // Get counts for dashboard
    const userCount = await User.countDocuments({ company: req.user.company });
    const pendingExpenses = await Expense.countDocuments({ 
      company: req.user.company,
      status: 'Pending'
    });
    const approvedExpenses = await Expense.countDocuments({ 
      company: req.user.company,
      status: 'Approved'
    });
    const rejectedExpenses = await Expense.countDocuments({ 
      company: req.user.company,
      status: 'Rejected'
    });
    const totalExpenses = pendingExpenses + approvedExpenses + rejectedExpenses;
    
    // Get recent expenses
    const recentExpenses = await Expense.find({ company: req.user.company })
      .populate('submittedBy')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Create stats object for the dashboard
    const stats = {
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      userCount
    };
    
    const company = await Company.findById(req.user.company);

    res.render('admin/dashboard', {
      stats,
      recentExpenses,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

// Company Settings
router.get('/company', ensureAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.user.company);
    const userCount = await User.countDocuments({ company: req.user.company });
    const expenseCount = await Expense.countDocuments({ company: req.user.company });
    const workflowCount = await ApprovalWorkflow.countDocuments({ company: req.user.company });
    
    res.render('admin/company', {
      company,
      userCount,
      expenseCount,
      workflowCount,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading company settings');
    res.redirect('/admin/dashboard');
  }
});

// Update Company Settings
router.post('/company/update', ensureAdmin, async (req, res) => {
  try {
    const { name, defaultCurrency, country } = req.body;
    await Company.findByIdAndUpdate(req.user.company, {
      name,
      defaultCurrency,
      country
    });
    req.flash('success_msg', 'Company settings updated successfully');
    res.redirect('/admin/company');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating company settings');
    res.redirect('/admin/company');
  }
});

// Approval Workflows
router.get('/workflows', ensureAdmin, async (req, res) => {
  try {
    const workflows = await ApprovalWorkflow.find({ company: req.user.company });
    const managers = await User.find({ company: req.user.company, role: { $in: ['Manager', 'Admin'] } });
    const company = await Company.findById(req.user.company);
    res.render('admin/workflows', {
      workflows,
      managers,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading approval workflows');
    res.redirect('/admin/dashboard');
  }
});

// Render New Workflow Form
router.get('/workflows/new', ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({ company: req.user.company });
    const company = await Company.findById(req.user.company);

    res.render('admin/workflows/new', {
      users,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading workflow form');
    res.redirect('/admin/workflows');
  }
});

// Create Workflow (form posts to /admin/workflows/new)
router.post('/workflows/new', ensureAdmin, async (req, res) => {
  try {
    const { name, includeManagerApproval, steps } = req.body;

    const parsedSteps = parseWorkflowSteps(steps);

    // support checkbox name 'active' or 'isActive'
    const activeFlag = (req.body.active === 'on') || (req.body.isActive === 'on');

    const newWorkflow = new ApprovalWorkflow({
      name,
      company: req.user.company,
      includeManagerApproval: includeManagerApproval === 'on',
      isActive: activeFlag,
      steps: parsedSteps
    });

    await newWorkflow.save();

    req.flash('success_msg', 'Approval workflow created successfully');
    res.redirect('/admin/workflows');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating approval workflow');
    res.redirect('/admin/workflows');
  }
});

// View a workflow
router.get('/workflows/view/:id', ensureAdmin, async (req, res) => {
  try {
  const workflow = await ApprovalWorkflow.findById(req.params.id).populate('steps.approvers').populate('steps.specificApproverOverride');
    if (!workflow) {
      req.flash('error_msg', 'Workflow not found');
      return res.redirect('/admin/workflows');
    }

    const company = await Company.findById(req.user.company);

    res.render('admin/workflows/view', {
      workflow,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving workflow');
    res.redirect('/admin/workflows');
  }
});

// Edit workflow form
router.get('/workflows/edit/:id', ensureAdmin, async (req, res) => {
  try {
  const workflow = await ApprovalWorkflow.findById(req.params.id).populate('steps.approvers').populate('steps.specificApproverOverride');
    if (!workflow) {
      req.flash('error_msg', 'Workflow not found');
      return res.redirect('/admin/workflows');
    }

    const users = await User.find({ company: req.user.company });
    const company = await Company.findById(req.user.company);

    res.render('admin/workflows/edit', {
      workflow,
      users,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading workflow edit form');
    res.redirect('/admin/workflows');
  }
});

// Delete workflow via /admin/workflows/delete/:id
router.delete('/workflows/delete/:id', ensureAdmin, async (req, res) => {
  try {
    await ApprovalWorkflow.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Approval workflow deleted successfully');
    res.redirect('/admin/workflows');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting approval workflow');
    res.redirect('/admin/workflows');
  }
});
// Create Approval Workflow
router.post('/workflows', ensureAdmin, async (req, res) => {
  try {
    const { name, includeManagerApproval, steps } = req.body;
    
    const parsedSteps = parseWorkflowSteps(steps);
    const activeFlag = (req.body.active === 'on') || (req.body.isActive === 'on');

    const newWorkflow = new ApprovalWorkflow({
      name,
      company: req.user.company,
      includeManagerApproval: includeManagerApproval === 'on',
      isActive: activeFlag,
      steps: parsedSteps
    });
    
    await newWorkflow.save();
    
    req.flash('success_msg', 'Approval workflow created successfully');
    res.redirect('/admin/workflows');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating approval workflow');
    res.redirect('/admin/workflows');
  }
});

// Update Approval Workflow
router.put('/workflows/:id', ensureAdmin, async (req, res) => {
  try {
    const { name, includeManagerApproval, steps } = req.body;

    // Robustly detect the active flag from different form naming conventions/values
    const rawActive = req.body.isActive ?? req.body.active ?? req.body['isActive'] ?? req.body['active'];
    // Accept 'on', 'true', true
    const activeFlag = rawActive === 'on' || rawActive === 'true' || rawActive === true;

    // Helpful debug log so you can see what was submitted when editing
    console.log(`[admin] updating workflow ${req.params.id} - rawActive:`, rawActive, 'computed activeFlag:', activeFlag);

    const parsedSteps = parseWorkflowSteps(steps);

    // Use findById + save to ensure boolean casting and middleware run
    const workflow = await ApprovalWorkflow.findById(req.params.id);
    if (!workflow) {
      req.flash('error_msg', 'Workflow not found');
      return res.redirect('/admin/workflows');
    }

    console.log(`[admin] before update workflow ${req.params.id} isActive:`, workflow.isActive);

    workflow.name = name;
    workflow.includeManagerApproval = includeManagerApproval === 'on';
    workflow.steps = parsedSteps;
    workflow.isActive = !!activeFlag;

    await workflow.save();

    console.log(`[admin] after update workflow ${req.params.id} isActive:`, workflow.isActive);
    
    req.flash('success_msg', 'Approval workflow updated successfully');
    res.redirect('/admin/workflows');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating approval workflow');
    res.redirect('/admin/workflows');
  }
});

// Delete Approval Workflow
router.delete('/workflows/:id', ensureAdmin, async (req, res) => {
  try {
    await ApprovalWorkflow.findByIdAndDelete(req.params.id);
    
    req.flash('success_msg', 'Approval workflow deleted successfully');
    res.redirect('/admin/workflows');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting approval workflow');
    res.redirect('/admin/workflows');
  }
});

// All Expenses
router.get('/expenses', ensureAdmin, async (req, res) => {
  try {
    const { status, user, category, startDate, endDate } = req.query;
    
    // Build filter
    const filter = { company: req.user.company };
    
    if (status) {
      filter.status = status;
    }
    
    if (user) {
      filter.submittedBy = user;
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.date = { $lte: new Date(endDate) };
    }
    
    const expenses = await Expense.find(filter)
      .populate('submittedBy')
      .sort({ createdAt: -1 });
    
    const users = await User.find({ company: req.user.company });
    
    // Get unique categories
    const categories = await Expense.distinct('category', { company: req.user.company });
    const company = await Company.findById(req.user.company);

    res.render('admin/expenses', {
      expenses,
      users,
      categories,
      filter: req.query,
      user: req.user,
      company
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving expenses');
    res.redirect('/admin/dashboard');
  }
});

// Admin Override
router.post('/override/:id', ensureAdmin, async (req, res) => {
  try {
    const { decision, comment } = req.body;
    
    await Expense.findByIdAndUpdate(req.params.id, {
      status: decision,
      $push: {
        approvalHistory: {
          step: 999, // Special step for admin override
          approver: req.user._id,
          decision,
          comment,
          timestamp: Date.now()
        }
      }
    });
    
  // Guard against undefined decision
  const safeDecisionLower = decision ? decision.toString().toLowerCase() : '';
  req.flash('success_msg', `Expense ${safeDecisionLower} by admin override`);
    res.redirect('/admin/expenses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error processing override');
    res.redirect('/admin/expenses');
  }
});

module.exports = router;