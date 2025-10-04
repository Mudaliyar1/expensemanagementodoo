const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

// Welcome Page
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'Financer' || req.user.role === 'Director') {
      return res.redirect('/approvals/dashboard');
    }
    // Optionally, redirect other roles to their dashboards
    if (req.user.role === 'Admin') {
      return res.redirect('/admin/dashboard');
    }
    if (req.user.role === 'Manager') {
      return res.redirect('/approvals/dashboard');
    }
    if (req.user.role === 'Employee') {
      return res.redirect('/expenses/dashboard');
    }
  }
  res.render('welcome');
});

// Dashboard based on user role
router.get('/dashboard', ensureAuthenticated, (req, res) => {
  switch(req.user.role) {
    case 'Admin':
      res.redirect('/admin/dashboard');
      break;
    case 'Manager':
      res.redirect('/approvals/dashboard');
      break;
    case 'Employee':
      res.redirect('/expenses/dashboard');
      break;
    default:
      res.redirect('/');
  }
});

module.exports = router;