const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureManager } = require('../middleware/auth');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const User = require('../models/User');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const Company = require('../models/Company');

// Delete individual processed approval (manager/employer)
router.post('/delete/:id', ensureManager, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      req.flash('error_msg', 'Expense not found');
      return res.redirect('/approvals/dashboard');
    }
    // Remove this manager's approval history for this expense
    expense.approvalHistory = expense.approvalHistory.filter(h => h.approver.toString() !== req.user._id.toString());
    await expense.save();
    req.flash('success_msg', 'Approval history deleted');
    res.redirect('/approvals/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting approval history');
    res.redirect('/approvals/dashboard');
  }
});

// Bulk delete processed approvals (manager/employer)
router.post('/bulk-delete', ensureManager, async (req, res) => {
  try {
    const ids = req.body.expenseIds || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      req.flash('error_msg', 'No approvals selected for deletion');
      return res.redirect('/approvals/dashboard');
    }
    const userId = req.user._id.toString();
    await Expense.updateMany(
      { _id: { $in: ids } },
      { $pull: { approvalHistory: { approver: userId } } }
    );
    req.flash('success_msg', 'Selected approval histories deleted');
    res.redirect('/approvals/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting approval histories');
    res.redirect('/approvals/dashboard');
  }
});

// Manager Dashboard
router.get('/dashboard', ensureManager, async (req, res) => {
  try {
    // Get expenses awaiting this manager's approval
    // Fetch pending approvals for this user (case-insensitive match for 'Pending')
    const userId = mongoose.Types.ObjectId(req.user._id);
    const pendingExpenses = await Expense.find({
      'approvalHistory': {
        $elemMatch: {
          'approver': userId,
          'decision': { $regex: '^pending$', $options: 'i' }
        }
      }
    }).populate('submittedBy').sort({ createdAt: -1 });
    
    // Get expenses this manager has already processed
    // Fetch processed approvals (Approved/Rejected) case-insensitively
    const processedExpenses = await Expense.find({
      'approvalHistory': {
        $elemMatch: {
          'approver': userId,
          'decision': { $regex: '^(approved|rejected)$', $options: 'i' }
        }
      }
    }).populate('submittedBy').sort({ createdAt: -1 });
    
    // If manager, also get expenses from their team
    let teamExpenses = [];
    if (req.user.role === 'Manager') {
      const teamMembers = await User.find({ manager: req.user._id });
      const teamMemberIds = teamMembers.map(member => member._id);
      
      teamExpenses = await Expense.find({
        submittedBy: { $in: teamMemberIds }
      }).populate('submittedBy').sort({ createdAt: -1 });
    }
    
    res.render('approvals/dashboard', {
      pendingExpenses,
      processedExpenses,
      teamExpenses,
      user: req.user,
      company: await Company.findById(req.user.company)
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving approvals');
    res.redirect('/dashboard');
  }
});

// Approve/Reject Expense
router.post('/process/:id', ensureManager, async (req, res) => {
  try {
    // Normalize incoming form fields: some forms submit 'action' (approve/reject) while
    // others may submit 'decision'. Accept either and canonicalize to 'Approved'/'Rejected'.
    const rawAction = (req.body.action || req.body.decision || '').toString();
    const comment = req.body.comment || '';
    if (!rawAction) {
      req.flash('error_msg', 'No action specified');
      return res.redirect('/approvals/dashboard');
    }

    const actionLower = rawAction.toLowerCase();
    let decision;
    if (actionLower === 'approve' || actionLower === 'approved') {
      decision = 'Approved';
    } else if (actionLower === 'reject' || actionLower === 'rejected') {
      decision = 'Rejected';
    } else if (actionLower === 'override') {
      // Treat override as an admin approval action (approve by default) but only allow for Admins
      if (req.user.role !== 'Admin') {
        req.flash('error_msg', 'You are not authorized to perform an override');
        return res.redirect('/approvals/dashboard');
      }
      decision = 'Approved';
    } else {
      // Fallback: use rawAction value but normalized casing
      decision = rawAction.charAt(0).toUpperCase() + rawAction.slice(1);
    }

    const expense = await Expense.findById(req.params.id).populate('submittedBy');
    
    if (!expense) {
      req.flash('error_msg', 'Expense not found');
      return res.redirect('/approvals/dashboard');
    }
    
    // For managers, ensure they can only approve expenses from their team
    if (req.user.role === 'Manager') {
      // Check if the expense submitter is the manager themselves
      const isOwnExpense = expense.submittedBy._id.toString() === req.user._id.toString();
      
      // If not own expense, check if submitter is in manager's team
      if (!isOwnExpense) {
        const teamMembers = await User.find({ manager: req.user._id });
        const teamMemberIds = teamMembers.map(member => member._id.toString());
        
        if (!teamMemberIds.includes(expense.submittedBy._id.toString())) {
          req.flash('error_msg', 'You can only approve expenses from your team members');
          return res.redirect('/approvals/dashboard');
        }
      }
    }
    
    // Get current workflow step (the lowest step with any pending approval)
    const pendingSteps = expense.approvalHistory.filter(a => a.decision === 'Pending').map(a => a.step);
    const currentWorkflowStep = pendingSteps.length > 0 ? Math.min(...pendingSteps) : null;

    // Only allow approval if user's approval is in the current workflow step
    let approvalIndex = expense.approvalHistory.findIndex(approval => {
      const approverId = approval.approver && approval.approver._id ? approval.approver._id.toString() : (approval.approver ? approval.approver.toString() : null);
      const decisionVal = approval.decision ? approval.decision.toString().toLowerCase() : '';
      return approverId === req.user._id.toString() && decisionVal === 'pending' && approval.step === currentWorkflowStep;
    });

    if (approvalIndex === -1) {
      // Only allow Admin to override if no pending approvals
      if (req.user.role === 'Admin') {
        approvalIndex = expense.approvalHistory.findIndex(a => (a.decision || '').toString().toLowerCase() === 'pending');
        if (approvalIndex === -1) {
          if (decision === 'Rejected') {
            expense.status = 'Rejected';
          } else if (decision === 'Approved') {
            expense.status = 'Approved';
          }
          await expense.save();
          const safeDecisionLower = decision ? decision.toString().toLowerCase() : '';
          req.flash('success_msg', `Expense ${safeDecisionLower} successfully by admin`);
          return res.redirect('/approvals/dashboard');
        }
      } else {
        req.flash('error_msg', 'You can only approve/reject when your step is active.');
        return res.redirect('/approvals/dashboard');
      }
    }
    
  // Update approval decision (store normalized 'Approved'/'Rejected')
  expense.approvalHistory[approvalIndex].decision = decision;
  expense.approvalHistory[approvalIndex].comment = comment;
  expense.approvalHistory[approvalIndex].timestamp = Date.now();

  // Check if this is a rejection
  if (decision === 'Rejected') {
    expense.status = 'Rejected';
    // Remove all future step pending approvals
    expense.approvalHistory = expense.approvalHistory.filter(a => a.step <= expense.approvalHistory[approvalIndex].step);
    await expense.save();
    req.flash('success_msg', 'Expense rejected successfully');
    return res.redirect('/approvals/dashboard');
  }

  // Get the current step
  const currentStep = expense.approvalHistory[approvalIndex].step;
    const workflow = await ApprovalWorkflow.findById(expense.workflow);
    const stepConfig = workflow.steps.find(step => step.stepNumber === currentStep);
    
    if (!stepConfig) {
      req.flash('error_msg', 'Workflow step configuration not found');
      return res.redirect('/approvals/dashboard');
    }
    
    // Get all approvals for current step
    const currentStepApprovals = expense.approvalHistory.filter(
      approval => approval.step === currentStep
    );
    
    // Check if specific approver override is satisfied
    const specificApproverOverride = stepConfig.specificApproverOverride;
    if (specificApproverOverride && 
        specificApproverOverride.toString() === req.user._id.toString() && 
        decision === 'Approved') {
      // Move to next step or approve expense
      if (currentStep < workflow.steps.length) {
        // Add next step approvers
        const nextStep = workflow.steps.find(step => step.stepNumber === currentStep + 1);
        if (nextStep) {
          nextStep.approvers.forEach(approver => {
            expense.approvalHistory.push({
              step: currentStep + 1,
              approver,
              decision: 'Pending',
              comment: ''
            });
          });
          expense.currentApprovalStep = currentStep + 1;
        } else {
          // No more steps, approve expense
          expense.status = 'Approved';
        }
      } else {
        // Last step, approve expense
        expense.status = 'Approved';
      }
      
      await expense.save();
      req.flash('success_msg', 'Expense approved via override and moved to next step');
      return res.redirect('/approvals/dashboard');
    }
    
    // Check percentage rule
    const totalApprovers = currentStepApprovals.length;
    const approvedCount = currentStepApprovals.filter(
      approval => approval.decision === 'Approved'
    ).length;
    
    const approvalPercentage = (approvedCount / totalApprovers) * 100;
    
    if (approvalPercentage >= stepConfig.requiredApprovalPercentage) {
      // Move to next step or approve expense
      if (currentStep < workflow.steps.length) {
        // Add next step approvers
        const nextStep = workflow.steps.find(step => step.stepNumber === currentStep + 1);
        if (nextStep) {
          nextStep.approvers.forEach(approver => {
            expense.approvalHistory.push({
              step: currentStep + 1,
              approver,
              decision: 'Pending',
              comment: ''
            });
          });
          expense.currentApprovalStep = currentStep + 1;
        } else {
          // No more steps, approve expense
          expense.status = 'Approved';
        }
      } else {
        // Last step, approve expense
        expense.status = 'Approved';
      }
    }
    
    await expense.save();
    req.flash('success_msg', 'Expense processed successfully');
    res.redirect('/approvals/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error processing approval');
    res.redirect('/approvals/dashboard');
  }
});

module.exports = router;