const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: {
    type: String,
    required: true
  },
  convertedAmount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  receipt: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  currentApprovalStep: {
    type: Number,
    default: 0
  },
  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalWorkflow',
    required: true
  },
  approvalHistory: [{
    step: Number,
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    decision: {
      type: String,
      enum: ['Approved', 'Rejected', 'Pending']
    },
    comment: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Expense = mongoose.model('Expense', ExpenseSchema);

module.exports = Expense;