const mongoose = require('mongoose');

const ApprovalWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  includeManagerApproval: {
    type: Boolean,
    default: true
  },
  steps: [{
    stepNumber: Number,
    approvers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    requiredApprovalPercentage: {
      type: Number,
      min: 1,
      max: 100,
      default: 100
    },
    specificApproverOverride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', ApprovalWorkflowSchema);

module.exports = ApprovalWorkflow;